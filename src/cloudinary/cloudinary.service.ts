import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export interface UploadSignaturePayload {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  transformation: string;
}

// Applied at upload time so Cloudinary stores the compressed/resized version
// rather than the original. Keeps free-tier storage in check without losing
// visible quality for product cards / detail views.
const UPLOAD_TRANSFORMATION = 'c_limit,w_2400,h_2400,q_auto,f_auto';

@Injectable()
export class CloudinaryService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.getOrThrow<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  /**
   * Generates a signed upload payload the FE uses to POST a file directly to
   * Cloudinary. Only the params signed here are honored by Cloudinary — the FE
   * cannot inject extra params without breaking the signature.
   */
  signUpload(userId: string): UploadSignaturePayload {
    const cloudName = this.config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.getOrThrow<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.getOrThrow<string>('CLOUDINARY_API_SECRET');
    const timestamp = Math.round(Date.now() / 1000);
    const folder = `pet-pod/${userId}`;
    const transformation = UPLOAD_TRANSFORMATION;

    const signature = cloudinary.utils.api_sign_request(
      { folder, timestamp, transformation },
      apiSecret,
    );

    return {
      signature,
      timestamp,
      cloudName,
      apiKey,
      folder,
      transformation,
    };
  }

  async deleteByPublicId(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      });
    } catch (err) {
      // We don't want the user-facing delete to fail because of a Cloudinary
      // hiccup — log and move on. The DB record is the source of truth.
      console.warn(
        `[Cloudinary] failed to delete ${publicId}: ${(err as Error).message}`,
      );
    }
  }
}
