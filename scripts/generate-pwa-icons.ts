import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

async function generateIcons() {
  const logoPath = path.resolve(process.cwd(), "public/logo.png");
  const iconsDir = path.resolve(process.cwd(), "public/icons");

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // 1. Crop the starball emblem (0 to 680 width, 0 to 724 height)
  const starballCrop = await sharp(logoPath)
    .extract({ left: 0, top: 0, width: 680, height: 724 })
    .toBuffer();

  // 2. Generate 512x512 with safe padding (transparent background)
  const icon512 = await sharp(starballCrop)
    .resize(480, 480, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 16,
      bottom: 16,
      left: 16,
      right: 16,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(path.resolve(iconsDir, "icon-512.png"));

  console.log("Created public/icons/icon-512.png");

  // 3. Generate 192x192
  await sharp(starballCrop)
    .resize(176, 176, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 8,
      bottom: 8,
      left: 8,
      right: 8,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(path.resolve(iconsDir, "icon-192.png"));

  console.log("Created public/icons/icon-192.png");

  // 4. Generate App Router icon (src/app/icon.png) - 32x32 & favicon.ico
  await sharp(starballCrop)
    .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.resolve(process.cwd(), "src/app/icon.png"));

  // Also write public/favicon.ico
  await sharp(starballCrop)
    .resize(48, 48, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.resolve(process.cwd(), "public/favicon.ico"));

  // 5. Generate apple-icon (180x180)
  await sharp(starballCrop)
    .resize(160, 160, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 10,
      bottom: 10,
      left: 10,
      right: 10,
      background: { r: 7, g: 11, b: 20, alpha: 1 }, // dark navy background for iOS home screen
    })
    .png()
    .toFile(path.resolve(process.cwd(), "src/app/apple-icon.png"));

  console.log("Created all PWA & browser icons successfully!");
}

generateIcons().catch(console.error);
