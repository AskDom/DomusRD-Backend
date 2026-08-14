jest.mock("../../src/config/prisma", () => ({
  uploadedImage: { createMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  user:          { findUnique: jest.fn() },
}));
jest.mock("../../src/config/cloudinary", () => ({
  cloudinary: { uploader: { destroy: jest.fn() } },
}));

const prisma     = require("../../src/config/prisma");
const { cloudinary } = require("../../src/config/cloudinary");
const { uploadImages, deleteImage } = require("../../src/controllers/upload.controller");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("upload.controller uploadImages()", () => {
  it("registra quién subió cada imagen", async () => {
    const req = {
      user:  { userId: "user-1" },
      files: [
        { path: "https://res.cloudinary.com/demo/image/upload/v1/domify/properties/a.jpg" },
        { path: "https://res.cloudinary.com/demo/image/upload/v1/domify/properties/b.jpg" },
      ],
    };
    const res = mockRes();

    await uploadImages(req, res);

    expect(prisma.uploadedImage.createMany).toHaveBeenCalledWith({
      data: [
        { url: req.files[0].path, publicId: "domify/properties/a", userId: "user-1" },
        { url: req.files[1].path, publicId: "domify/properties/b", userId: "user-1" },
      ],
      skipDuplicates: true,
    });
    expect(res.status).toHaveBeenCalledWith(200);
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
