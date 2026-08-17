import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import type { Env } from '../../config/env';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';

/** Kabul edilen görsel türleri ve sihirli baytları. */
const ALLOWED = [
  { mime: 'image/jpeg', ext: '.jpg', magic: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', ext: '.png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', ext: '.webp', magic: [0x52, 0x49, 0x46, 0x46] },
] as const;

const MAX_BYTES = 5 * 1024 * 1024;

export interface UploadedImage {
  url: string;
  key: string;
  bytes: number;
}

/**
 * Görsel yükleme ve servis etme.
 *
 * Yerel dosya sistemine yazar. Üretimde S3/R2'ye geçilecekse yalnızca bu
 * servis değişir — çağıran kod dosyanın nerede durduğunu bilmez.
 *
 * Güvenlik: dosya türü uzantıya veya istemcinin bildirdiği MIME'a göre
 * değil, **dosyanın ilk baytlarına** göre belirlenir. Aksi hâlde `.jpg`
 * uzantılı bir HTML dosyası yüklenip aynı origin'de çalıştırılabilirdi.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly root: string;
  private readonly publicBase: string;

  constructor(config: ConfigService<Env, true>) {
    this.root = resolve(process.cwd(), config.get('MEDIA_ROOT', { infer: true }));
    this.publicBase = `${config.get('API_PUBLIC_URL', { infer: true })}/media`;
  }

  /** Dosyanın gerçek türünü sihirli baytlardan tespit eder. */
  private detectType(buffer: Buffer): (typeof ALLOWED)[number] {
    const match = ALLOWED.find((candidate) =>
      candidate.magic.every((byte, index) => buffer[index] === byte),
    );

    if (!match) {
      throw AppError.unprocessable(
        ErrorCode.VALIDATION_FAILED,
        'Yalnızca JPEG, PNG veya WebP görseli yüklenebilir.',
      );
    }

    return match;
  }

  async upload(
    buffer: Buffer,
    options: { folder: 'stores' | 'bags'; ownerId: string; originalName?: string },
  ): Promise<UploadedImage> {
    if (buffer.length === 0) {
      throw AppError.unprocessable(ErrorCode.VALIDATION_FAILED, 'Boş dosya yüklenemez.');
    }

    if (buffer.length > MAX_BYTES) {
      throw AppError.unprocessable(
        ErrorCode.VALIDATION_FAILED,
        `Görsel en fazla ${MAX_BYTES / 1024 / 1024} MB olabilir.`,
      );
    }

    const type = this.detectType(buffer);

    // Dosya adı istemciden gelmez: yol geçişi (path traversal) ve çakışma
    // riski tamamen ortadan kalksın.
    const key = `${options.folder}/${options.ownerId}/${randomUUID()}${type.ext}`;
    const target = join(this.root, key);

    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, buffer);

    this.logger.log(
      `Görsel yüklendi: ${key} (${(buffer.length / 1024).toFixed(0)} KB, ${type.mime})`,
    );

    return {
      url: `${this.publicBase}/${key}`,
      key,
      bytes: buffer.length,
    };
  }

  /** İçerik adresli önbellek anahtarı — aynı görsel iki kez yazılmasın. */
  static fingerprint(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  }

  /** Yüklenen dosyanın uzantısı beklenen kümede mi (ek savunma). */
  static hasAllowedExtension(fileName: string): boolean {
    const ext = extname(fileName).toLowerCase();
    return ALLOWED.some((candidate) => candidate.ext === ext) || ext === '.jpeg';
  }
}
