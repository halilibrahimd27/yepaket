import {
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Roles, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { StoreAccessService } from '../partner/store-access.service';
import { MediaService } from './media.service';

/** Multer bellek deposu; dosya diske ancak doğrulandıktan sonra yazılır. */
interface UploadedMulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@ApiTags('media')
@ApiBearerAuth('access-token')
@Controller('media')
@Roles('PARTNER')
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly access: StoreAccessService,
  ) {}

  @Post('images')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Paket veya mağaza görseli yükler',
    description:
      'Dosya türü uzantıya değil, dosyanın ilk baytlarına göre belirlenir. ' +
      'Dosya adı sunucuda üretilir; istemciden gelen ad kullanılmaz.',
  })
  async uploadImage(
    @UploadedFile() file: UploadedMulterFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Query('folder') folder?: string,
    @Query('storeId') storeId?: string,
  ) {
    if (!file) {
      throw AppError.unprocessable(ErrorCode.VALIDATION_FAILED, 'Dosya gönderilmedi.');
    }

    // Yükleyen kullanıcının gerçekten bu mağazaya erişimi olmalı; aksi hâlde
    // bir partner başka bir işletmenin klasörüne dosya bırakabilirdi.
    const store = storeId
      ? await this.access.requireStore(user, storeId, 'MANAGER')
      : await this.access.defaultStore(user);

    return this.media.upload(file.buffer, {
      folder: folder === 'stores' ? 'stores' : 'bags',
      ownerId: store.id,
    });
  }
}
