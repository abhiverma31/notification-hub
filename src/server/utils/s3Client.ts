import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, S3 } from '@aws-sdk/client-s3';

export const s3 = new S3({
  region: process.env.AWS_REGION,
});

export const getFileUrl = async (key: any) => {
  const params = {
    Bucket: process.env.CONFIG_BUCKET_NAME!,
    Key: key,
    ResponseCacheControl: 'no-store',
    ResponseContentDisposition: `attachment; filename=API_DOC.html`,
  };

  return getSignedUrl(s3, new GetObjectCommand(params), {
    expiresIn: Number.parseInt('604800'),
  });
};
