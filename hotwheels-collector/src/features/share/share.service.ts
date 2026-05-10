import prisma from '@/db';
import { randomUUID } from 'crypto';

export interface ShareLinkData {
  id: number;
  shareId: string;
  type: string; // 'collection' | 'model' | 'variant'
  targetId: number;
  isPublic: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  viewCount: number;
}

/**
 * Yeni bir paylaşım linki oluşturur
 */
export async function createShareLink(
  type: 'collection' | 'model' | 'variant',
  targetId: number,
  isPublic: boolean = true,
  expiresInDays?: number
): Promise<ShareLinkData> {
  const shareId = randomUUID();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const shareLink = await prisma.shareLink.create({
    data: {
      shareId,
      type,
      targetId,
      isPublic,
      expiresAt,
    },
  });

  return shareLink;
}

/**
 * ShareId ile paylaşım linkini bulur ve view count'u artırır
 */
export async function getShareLinkByShareId(
  shareId: string
): Promise<ShareLinkData | null> {
  const shareLink = await prisma.shareLink.findUnique({
    where: { shareId },
  });

  if (!shareLink) {
    return null;
  }

  // Expire kontrolü
  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
    return null;
  }

  // View count'u artır
  const updated = await prisma.shareLink.update({
    where: { shareId },
    data: {
      viewCount: {
        increment: 1,
      },
    },
  });

  return updated;
}

/**
 * Paylaşım linkini siler
 */
export async function deleteShareLink(shareId: string): Promise<boolean> {
  try {
    await prisma.shareLink.delete({
      where: { shareId },
    });
    return true;
  } catch (error) {
    console.error('Error deleting share link:', error);
    return false;
  }
}

/**
 * Kullanıcının tüm paylaşım linklerini getirir
 */
export async function getAllShareLinks(): Promise<ShareLinkData[]> {
  return prisma.shareLink.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Belirli bir target için paylaşım linkini bulur
 */
export async function getShareLinkByTarget(
  type: 'collection' | 'model' | 'variant',
  targetId: number
): Promise<ShareLinkData | null> {
  return prisma.shareLink.findFirst({
    where: {
      type,
      targetId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

