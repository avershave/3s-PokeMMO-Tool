using System;
using System.IO;
using System.IO.Compression;

/// <summary>
/// Minimal 24-bit BGR image buffer used by the OCR pipeline on every platform.
/// System.Drawing.Common only runs on Windows from .NET 7 onward, so the shared
/// capture/preprocess code works on this type instead of System.Drawing.Bitmap.
/// Pixel layout matches Format24bppRgb (B, G, R per pixel, no row padding).
/// </summary>
sealed class RgbImage : IDisposable
{
    public int Width { get; }
    public int Height { get; }
    public int Stride => Width * 3;
    public byte[] Data { get; }

    public RgbImage(int width, int height)
    {
        Width = Math.Max(1, width);
        Height = Math.Max(1, height);
        Data = new byte[Width * Height * 3];
    }

    RgbImage(int width, int height, byte[] data)
    {
        Width = width;
        Height = height;
        Data = data;
    }

    public RgbImage Clone() => new RgbImage(Width, Height, (byte[])Data.Clone());

    /// <summary>Returns a copy of the top <paramref name="height"/> rows.</summary>
    public RgbImage CropTop(int height)
    {
        height = Math.Clamp(height, 1, Height);
        var dst = new RgbImage(Width, height);
        Buffer.BlockCopy(Data, 0, dst.Data, 0, dst.Data.Length);
        return dst;
    }

    public void Dispose() { }

    /// <summary>Writes the image as an 8-bit RGB PNG.</summary>
    public void SavePng(Stream output)
    {
        output.Write(PngSignature);

        Span<byte> ihdr = stackalloc byte[13];
        WriteBigEndian(ihdr, 0, (uint)Width);
        WriteBigEndian(ihdr, 4, (uint)Height);
        ihdr[8] = 8;  // bit depth
        ihdr[9] = 2;  // colour type: truecolour (RGB)
        ihdr[10] = 0; // compression
        ihdr[11] = 0; // filter
        ihdr[12] = 0; // interlace
        WriteChunk(output, "IHDR", ihdr);

        using (var idat = new MemoryStream())
        {
            using (var z = new ZLibStream(idat, CompressionLevel.Fastest, leaveOpen: true))
            {
                var row = new byte[1 + Width * 3];
                for (int y = 0; y < Height; y++)
                {
                    row[0] = 0; // filter type: none
                    int src = y * Stride;
                    for (int x = 0; x < Width; x++)
                    {
                        int s = src + x * 3;
                        int d = 1 + x * 3;
                        row[d] = Data[s + 2];     // R
                        row[d + 1] = Data[s + 1]; // G
                        row[d + 2] = Data[s];     // B
                    }
                    z.Write(row, 0, row.Length);
                }
            }
            WriteChunk(output, "IDAT", idat.GetBuffer().AsSpan(0, (int)idat.Length));
        }

        WriteChunk(output, "IEND", ReadOnlySpan<byte>.Empty);
    }

    public byte[] ToPngBytes()
    {
        using var ms = new MemoryStream();
        SavePng(ms);
        return ms.ToArray();
    }

    static readonly byte[] PngSignature = { 137, 80, 78, 71, 13, 10, 26, 10 };
    static readonly uint[] CrcTable = BuildCrcTable();

    static uint[] BuildCrcTable()
    {
        var table = new uint[256];
        for (uint n = 0; n < 256; n++)
        {
            uint c = n;
            for (int k = 0; k < 8; k++)
                c = (c & 1) != 0 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
            table[n] = c;
        }
        return table;
    }

    static uint UpdateCrc(uint crc, ReadOnlySpan<byte> bytes)
    {
        foreach (var b in bytes)
            crc = CrcTable[(crc ^ b) & 0xFF] ^ (crc >> 8);
        return crc;
    }

    static void WriteBigEndian(Span<byte> buf, int offset, uint value)
    {
        buf[offset] = (byte)(value >> 24);
        buf[offset + 1] = (byte)(value >> 16);
        buf[offset + 2] = (byte)(value >> 8);
        buf[offset + 3] = (byte)value;
    }

    static void WriteChunk(Stream output, string type, ReadOnlySpan<byte> data)
    {
        Span<byte> header = stackalloc byte[8];
        WriteBigEndian(header, 0, (uint)data.Length);
        for (int i = 0; i < 4; i++) header[4 + i] = (byte)type[i];
        output.Write(header);
        output.Write(data);

        uint crc = UpdateCrc(0xFFFFFFFFu, header.Slice(4, 4));
        crc = UpdateCrc(crc, data) ^ 0xFFFFFFFFu;
        Span<byte> crcBytes = stackalloc byte[4];
        WriteBigEndian(crcBytes, 0, crc);
        output.Write(crcBytes);
    }
}
