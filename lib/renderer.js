import sharp from "sharp";
import opentype from "opentype.js";
import { getLogoPosition } from "@/lib/designer";
import { POPPINS_BOLD_B64 } from "@/lib/font-data";
import { ROCKWELL_NOVA_BOLD_B64 } from "@/lib/font-data-bean-buddies";

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

  // Per-client font selection
  const CLIENT_FONTS = {
    "bean-buddies": ROCKWELL_NOVA_BOLD_B64,
  };
  const fontB64 = CLIENT_FONTS[template.slug] || POPPINS_BOLD_B64;

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
    // opentype.js: text to SVG vector paths - no system fonts needed
    const fontBuf = Buffer.from(fontB64, "base64");
    const font = opentype.parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength));

    const W = fmt.w;
    const H = fmt.h;
    const words = textOnImage.trim().split(/\s+/);
    const fontSize = Math.floor(W * template.text.size_ratio);
    const isLogoTop = template.logo.position && template.logo.position.includes("top");
    const textY = isLogoTop ? Math.floor(H * 0.75) : Math.floor(H * 0.20);

    let lines;
    if (words.length > 5) {
      const mid = Math.ceil(words.length / 2);
      lines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
    } else {
      lines = [textOnImage.trim()];
    }

    const textColor = template.text.color === "#FFFFFF" || template.text.color === "#ffffff" ? "white" : "black";
    const lineImgs = [];
    for (const line of lines) {
      const path = font.getPath(line, 0, fontSize, fontSize);
      const b = path.getBoundingBox();
      const pw = Math.ceil(b.x2 - b.x1) + 20;
      const ph = Math.ceil(b.y2 - b.y1) + 20;
      const pathSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}">` +
        `<path d="${path.toPathData(2)}" fill="${textColor}" transform="translate(${Math.round(-b.x1+10)},${Math.round(-b.y1+10)})"/>` +
        `</svg>`;
      const img = await sharp(Buffer.from(pathSvg)).png().toBuffer();
      const meta = await sharp(img).metadata();
      lineImgs.push({ img, w: meta.width, h: meta.height });
    }

    const totalH = lineImgs.reduce((s, l) => s + l.h + 8, 0) + 24;
    const bgRgb = hexToRgb(template.colors.primary);
    const bgBuf = Buffer.alloc(W * totalH * 4);
    for (let p = 0; p < W * totalH; p++) {
      bgBuf[p*4] = bgRgb.r; bgBuf[p*4+1] = bgRgb.g; bgBuf[p*4+2] = bgRgb.b; bgBuf[p*4+3] = 217;
    }
    composites.push({ input: bgBuf, raw: { width: W, height: totalH, channels: 4 }, top: textY, left: 0 });

    let curY = textY + 12;
    for (const { img, w: lw, h: lh } of lineImgs) {
      composites.push({ input: img, top: curY, left: Math.floor((W - lw) / 2) });
      curY += lh + 8;
    }
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
