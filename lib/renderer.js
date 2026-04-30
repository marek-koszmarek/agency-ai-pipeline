import sharp from "sharp";
import fs from "fs";
import path from "path";
import { getLogoPosition } from "@/lib/designer";

export const FORMATS_RENDERER = {
  instagram_feed:   { w: 1080, h: 1350 },
  instagram_story:  { w: 1080, h: 1920 },
  instagram_square: { w: 1080, h: 1080 },
  facebook_feed:    { w: 1080, h: 1350 },
};

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const enc = (str) => str.split("").map(c => {
  const code = c.charCodeAt(0);
  return (code > 127 || "&<>\"".includes(c)) ? `&#${code};` : c;
}).join("");

export async function renderTemplate({ productImageBase64, template, textOnImage, logoBase64, formatKey }) {
  const fmt = FORMATS_RENDERER[formatKey];
  if (!fmt) throw new Error(`Nieznany format: ${formatKey}`);

  const fontB64 = (() => {
    try {
      return fs.readFileSync(path.join(process.cwd(), "public", "fonts", "Poppins-Bold.ttf")).toString("base64");
    } catch { return null; }
  })();

  const bgRgb = hexToRgb(template.background.value);
  let canvas = await sharp({
    create: {
      width: fmt.w,
      height: fmt.h,
      channels: 4,
      background: { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 255 },
    },
  }).png().toBuffer();

  const composites = [];

  if (productImageBase64) {
    const productBuffer = Buffer.from(productImageBase64, "base64");
    const targetW = Math.floor(fmt.w * template.product.scale);

    let resizedProduct = await sharp(productBuffer)
      .resize(targetW, null, { fit: "inside" })
      .toBuffer();

    const prodMeta = await sharp(resizedProduct).metadata();
    const prodW = prodMeta.width;
    const prodH = prodMeta.height;

    if (template.product.drop_shadow) {
      const blur = template.product.shadow_blur || 20;
      const opacity = Math.round((template.product.shadow_opacity || 0.3) * 255);
      const svgShadow = `<svg width="${prodW + blur * 2}" height="${prodH + blur * 2}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="ds">
            <feDropShadow dx="0" dy="${Math.floor(blur * 0.3)}" stdDeviation="${Math.floor(blur * 0.5)}" flood-color="rgba(0,0,0,${template.product.shadow_opacity || 0.3})"/>
          </filter>
        </defs>
        <image href="data:image/png;base64,${resizedProduct.toString("base64")}"
          x="${blur}" y="${blur}" width="${prodW}" height="${prodH}" filter="url(#ds)"/>
      </svg>`;
      resizedProduct = await sharp(Buffer.from(svgShadow)).png().toBuffer();
      const shadowMeta = await sharp(resizedProduct).metadata();
      const sW = shadowMeta.width;
      const sH = shadowMeta.height;
      const left = template.product.position === "left"
        ? Math.floor(fmt.w * 0.05)
        : Math.floor((fmt.w - sW) / 2);
      const top = Math.floor((fmt.h - sH) / 2);
      composites.push({ input: resizedProduct, left: Math.max(0, left), top: Math.max(0, top) });
    } else {
      const left = template.product.position === "left"
        ? Math.floor(fmt.w * 0.05)
        : Math.floor((fmt.w - prodW) / 2);
      const top = Math.floor((fmt.h - prodH) / 2);
      composites.push({ input: resizedProduct, left: Math.max(0, left), top: Math.max(0, top) });
    }
  }

  if (textOnImage && textOnImage.trim()) {
    const fontFaceCSS = fontB64
      ? `@font-face { font-family: 'BrandFont'; src: url('data:font/truetype;base64,${fontB64}'); }`
      : "";
    const fontFamily = fontB64 ? "BrandFont, sans-serif" : "DejaVu Sans, Liberation Sans, Arial, sans-serif";
    const fontSize = Math.floor(fmt.w * template.text.size_ratio);
    const textColor = template.text.color;
    const primaryColor = template.colors.primary;
    const letterSpacing = template.text.letter_spacing || 0;
    const encoded = enc(textOnImage.trim());

    let svgContent = "";
    const W = fmt.w;
    const H = fmt.h;

    if (template.text.placement === "bottom_band") {
      const bandY = H * 0.82;
      const rectY = bandY - fontSize - 20;
      const rectH = fontSize + 48;
      const rgb = hexToRgb(primaryColor);
      svgContent = `
        <rect x="0" y="${Math.floor(rectY)}" width="${W}" height="${rectH}"
          fill="rgb(${rgb.r},${rgb.g},${rgb.b})" fill-opacity="0.85"/>
        <text x="${W / 2}" y="${Math.floor(bandY + fontSize * 0.3)}"
          font-family="${fontFamily}" font-size="${fontSize}" font-weight="${template.text.weight}"
          fill="${textColor}" text-anchor="middle" letter-spacing="${letterSpacing}">${encoded}</text>`;
    } else if (template.text.placement === "golden_ratio") {
      const textY = Math.floor(H * 0.618);
      const rectY = textY - fontSize - 20;
      svgContent = `
        <rect x="0" y="${rectY}" width="${W}" height="${fontSize + 48}"
          fill="black" fill-opacity="0.42"/>
        <text x="${W / 2}" y="${textY}"
          font-family="${fontFamily}" font-size="${fontSize}" font-weight="${template.text.weight}"
          fill="${textColor}" text-anchor="middle" letter-spacing="${letterSpacing}">${encoded}</text>`;
    } else {
      const textY = Math.floor(H * 0.72);
      const rectY = textY - fontSize - 20;
      svgContent = `
        <rect x="0" y="${rectY}" width="${W}" height="${fontSize + 48}"
          fill="black" fill-opacity="0.42"/>
        <text x="${W / 2}" y="${textY}"
          font-family="${fontFamily}" font-size="${fontSize}" font-weight="${template.text.weight}"
          fill="${textColor}" text-anchor="middle" letter-spacing="${letterSpacing}">${encoded}</text>`;
    }

    const svgOverlay = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs><style>${fontFaceCSS}</style></defs>
      ${svgContent}
    </svg>`;
    composites.push({ input: Buffer.from(svgOverlay), top: 0, left: 0 });
  }

  if (logoBase64) {
    const logoBuffer = Buffer.from(logoBase64, "base64");
    const maxLogoW = Math.floor(fmt.w * template.logo.maxWidthRatio);
    const resizedLogo = await sharp(logoBuffer)
      .resize(maxLogoW, null, { fit: "inside" })
      .toBuffer();
    const logoMeta = await sharp(resizedLogo).metadata();
    const pos = getLogoPosition(
      template.logo.position, fmt.w, fmt.h, logoMeta.width, logoMeta.height
    );
    composites.push({ input: resizedLogo, top: pos.y, left: pos.x });
  }

  const result = composites.length > 0
    ? await sharp(canvas).composite(composites).png().toBuffer()
    : canvas;

  return result.toString("base64");
}
