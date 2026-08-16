jest.mock("../../src/config/prisma", () => ({
  uploadedImage: { createMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  user:          { findUnique: jest.fn() },
}));
jest.mock("../../src/config/cloudinary", () => {
  // Mantenemos la implementación real de isValidImageBuffer (es pura, sin
  // red ni estado) y el uploadBufferToCloudinary se mockea para no tocar
  // Cloudinary en los tests. cloudinary.uploader.destroy igual que antes.
  const actual = jest.requireActual("../../src/config/cloudinary");
  return {
    ...actual,
    cloudinary: { uploader: { destroy: jest.fn() } },
    uploadBufferToCloudinary: jest.fn(),
  };
});

const prisma     = require("../../src/config/prisma");
const { cloudinary, isValidImageBuffer, uploadBufferToCloudinary } = require("../../src/config/cloudinary");
const { uploadImages, deleteImage } = require("../../src/controllers/upload.controller");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

function pngBuffer() {
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(8)]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("config/cloudinary isValidImageBuffer() — magic bytes", () => {
  it("reconoce JPEG por su firma", () => {
    const buf = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(16)]);
    expect(isValidImageBuffer(buf)).toBe(true);
  });

  it("reconoce PNG por su firma", () => {
    expect(isValidImageBuffer(pngBuffer())).toBe(true);
  });

  it("reconoce WEBP por su firma", () => {
    const buf = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP"), Buffer.alloc(4)]);
    expect(isValidImageBuffer(buf)).toBe(true);
  });

  it("rechaza un archivo HTML disfrazado de imagen", () => {
    expect(isValidImageBuffer(Buffer.from("<!DOCTYPE html><html><body>x</body></html>"))).toBe(false);
  });

  it("rechaza buffers demasiado cortos", () => {
    expect(isValidImageBuffer(Buffer.from([0xFF, 0xD8]))).toBe(false);
  });
});

describe("upload.controller uploadImages()", () => {
  it("valida magic bytes, sube cada imagen y registra quién la subió", async () => {
    uploadBufferToCloudinary
      .mockResolvedValueOnce({ secure_url: "https://res.cloudinary.com/demo/image/upload/v1/domify/properties/a.jpg" })
      .mockResolvedValueOnce({ secure_url: "https://res.cloudinary.com/demo/image/upload/v1/domify/properties/b.jpg" });
    const req = {
      user:  { userId: "user-1" },
      files: [{ buffer: pngBuffer() }, { buffer: pngBuffer() }],
    };
    const res = mockRes();

    await uploadImages(req, res);

    expect(uploadBufferToCloudinary).toHaveBeenCalledTimes(2);
    expect(prisma.uploadedImage.createMany).toHaveBeenCalledWith({
      data: [
        { url: "https://res.cloudinary.com/demo/image/upload/v1/domify/properties/a.jpg", publicId: "domify/properties/a", userId: "user-1" },
        { url: "https://res.cloudinary.com/demo/image/upload/v1/domify/properties/b.jpg", publicId: "domify/properties/b", userId: "user-1" },
      ],
      skipDuplicates: true,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: [
        "https://res.cloudinary.com/demo/image/upload/v1/domify/properties/a.jpg",
        "https://res.cloudinary.com/demo/image/upload/v1/domify/properties/b.jpg",
      ],
    });
  });

  it("rechaza 400 si no llegan archivos", async () => {
    const req = { user: { userId: "user-1" }, files: [] };
    const res = mockRes();

    await uploadImages(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(uploadBufferToCloudinary).not.toHaveBeenCalled();
  });

  it("rechaza 400 si el archivo tiene magic bytes de algo que no es imagen (HTML disfrazado de .png)", async () => {
    const req = { user: { userId: "user-1" }, files: [{ buffer: Buffer.from("<html><body>spoof</body></html>") }] };
    const res = mockRes();

    await uploadImages(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(uploadBufferToCloudinary).not.toHaveBeenCalled();
    expect(prisma.uploadedImage.createMany).not.toHaveBeenCalled();
  });
});

describe("upload.controller deleteImage() — IDOR", () => {
  const victimUrl = "https://res.cloudinary.com/demo/image/upload/v1/domify/properties/victim.jpg";

  it("permite borrar una imagen que el usuario subió él mismo", async () => {
    prisma.uploadedImage.findUnique.mockResolvedValue({ url: victimUrl, userId: "user-1" });
    prisma.user.findUnique.mockResolvedValue({ avatar: null });
    const req = { user: { userId: "user-1" }, body: { url: victimUrl } };
    const res = mockRes();

    await deleteImage(req, res);

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("domify/properties/victim");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rechaza borrar una imagen subida por OTRO usuario, aunque esté copiada en una propiedad propia (403)", async () => {
    // La imagen la subió "victim-user" — un atacante la copió al array
    // `images` de su propia propiedad, pero eso ya no alcanza para borrarla.
    prisma.uploadedImage.findUnique.mockResolvedValue({ url: victimUrl, userId: "victim-user" });
    prisma.user.findUnique.mockResolvedValue({ avatar: null });
    const req = { user: { userId: "attacker" }, body: { url: victimUrl } };
    const res = mockRes();

    await deleteImage(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

  it("rechaza una imagen sin registro de quién la subió y que no es el avatar propio (falla cerrado)", async () => {
    prisma.uploadedImage.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ avatar: null });
    const req = { user: { userId: "attacker" }, body: { url: victimUrl } };
    const res = mockRes();

    await deleteImage(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

  it("permite borrar el propio avatar aunque no haya registro en uploadedImage", async () => {
    prisma.uploadedImage.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ avatar: victimUrl });
    const req = { user: { userId: "user-1" }, body: { url: victimUrl } };
    const res = mockRes();

    await deleteImage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(cloudinary.uploader.destroy).toHaveBeenCalled();
  });
});
