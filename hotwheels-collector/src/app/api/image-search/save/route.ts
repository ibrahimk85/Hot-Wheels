import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/db';
import { getModelById } from '@/features/models/model.service';
import { downloadAndSaveImage, ModelDataForDownload } from '@/lib/image-download';
import { createImage } from '@/features/images/image.service';
import { clearModelSearchCache } from '@/features/image-search/image-search.service';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { modelId, imageUrl } = body;

    // Convert modelId to number if it's a string
    if (typeof modelId === 'string') {
      modelId = parseInt(modelId, 10);
    }

    if (!modelId || typeof modelId !== 'number' || isNaN(modelId)) {
      return NextResponse.json(
        { error: 'Invalid modelId. Must be a number.' },
        { status: 400 }
      );
    }

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json(
        { error: 'Invalid imageUrl. Must be a string.' },
        { status: 400 }
      );
    }

    console.log('Image save request:', { modelId, imageUrl: imageUrl.substring(0, 100) + '...' });

    // Fetch model data
    const model = await getModelById(modelId);

    if (!model) {
      console.error('[IMAGE SAVE] Model not found for ID:', modelId);
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      );
    }

    console.log('[IMAGE SAVE] Model found:', {
      id: model.id,
      castingName: model.castingName,
      toyNumber: model.toyNumber,
      subSeriesId: model.subSeries?.id,
      collectionId: model.subSeries?.collection?.id,
      collectionName: model.subSeries?.collection?.name,
      year: model.subSeries?.collection?.year?.year,
      variantsCount: model.variants?.length || 0,
      firstVariantYear: model.variants?.[0]?.year,
    });

    // Get year from multiple sources (fallback chain)
    let year: number | undefined = undefined;
    
    // 1. Try from model's direct collection -> year (most reliable)
    if (model.collection?.year?.year) {
      year = model.collection.year.year;
      console.log('[IMAGE SAVE] Year from model->collection->year:', year);
    }
    // 2. Try from subSeries -> collection -> year
    else if (model.subSeries?.collection?.year?.year) {
      year = model.subSeries.collection.year.year;
      console.log('[IMAGE SAVE] Year from subSeries->collection->year:', year);
    }
    // 3. Try from first variant's year
    else if (model.variants && model.variants.length > 0) {
      year = model.variants[0].year;
      console.log('[IMAGE SAVE] Year from first variant:', year);
    }
    
    // 4. If still no year, log warning but continue (downloadAndSaveImage will use current year as fallback)
    if (!year) {
      console.warn('[IMAGE SAVE] ⚠️ Year not found from any source! Will use current year as fallback.');
      console.warn('[IMAGE SAVE] Model structure:', {
        collection: model.collection,
        subSeries: model.subSeries,
        collectionId: model.collectionId,
        variants: model.variants?.map(v => ({ id: v.id, year: v.year })),
      });
    }

    // Get collection name (prefer direct collection, then subSeries collection)
    let collectionName: string | undefined = undefined;
    if (model.collection?.name) {
      collectionName = model.collection.name;
    } else if (model.subSeries?.collection?.name) {
      collectionName = model.subSeries.collection.name;
    }

    // Prepare model data for download
    const modelData: ModelDataForDownload = {
      castingName: model.castingName,
      year: year,
      collectionName: collectionName,
      toyNumber: model.toyNumber || undefined,
      variants: model.variants.map((variant) => ({
        toyNumber: variant.toyNumber || undefined,
      })),
    };

    console.log('[IMAGE SAVE] Model data for download:', JSON.stringify(modelData, null, 2));

    // Download and save image
    console.log('[IMAGE SAVE] Downloading image from:', imageUrl);
    console.log('[IMAGE SAVE] Model data for download:', JSON.stringify(modelData, null, 2));
    
    let relativePath: string;
    try {
      relativePath = await downloadAndSaveImage(imageUrl, modelData);
      console.log('[IMAGE SAVE] Image saved to file system:', relativePath);
      
      // Verify file actually exists on disk
      const absolutePath = path.join(process.cwd(), 'public', relativePath);
      const fileExists = fs.existsSync(absolutePath);
      console.log('[IMAGE SAVE] Verifying file exists on disk:', absolutePath, '→', fileExists);
      
      if (!fileExists) {
        throw new Error(`File was not written to disk: ${absolutePath}`);
      }
      
      const fileStats = await fs.promises.stat(absolutePath);
      console.log('[IMAGE SAVE] File stats:', { size: fileStats.size, exists: true });
      
      if (fileStats.size === 0) {
        throw new Error(`File was written but is empty: ${absolutePath}`);
      }
    } catch (downloadError) {
      console.error('[IMAGE SAVE] ❌ Error downloading/saving image:', downloadError);
      console.error('[IMAGE SAVE] Error details:', downloadError instanceof Error ? downloadError.message : String(downloadError));
      throw downloadError;
    }

    // Check if model already has images
    // Check both model.images array and mainImageId
    const existingImagesCount = model.images?.length || 0;
    const hasExistingImages = existingImagesCount > 0 || model.mainImageId !== null;
    
    console.log('Model image check:', {
      existingImagesCount,
      hasExistingImages,
      mainImageId: model.mainImageId,
      imagesArrayLength: model.images?.length || 0
    });

    // Get the highest order value for existing images to set the order for the new image
    let maxOrder: number | undefined = undefined;
    try {
      if (model.images && model.images.length > 0) {
        // Get all images for this model to find max order
        // Use a safer approach: get all images and find max in JavaScript
        const allModelImages = await prisma.image.findMany({
          where: { 
            modelId: model.id,
            order: { not: null } // Only get images with non-null order
          },
          select: { order: true },
        });
        
        if (allModelImages.length > 0) {
          // Find max order value
          const orders = allModelImages.map(img => img.order).filter((o): o is number => o !== null && o !== undefined);
          if (orders.length > 0) {
            maxOrder = Math.max(...orders) + 1;
          } else {
            maxOrder = existingImagesCount; // Use count as fallback
          }
        } else {
          // No images with order set, use count as fallback
          maxOrder = existingImagesCount;
        }
      } else {
        // First image - set order to 0
        maxOrder = 0;
      }
    } catch (orderError) {
      console.error('Error calculating order:', orderError);
      // Fallback: use existing images count
      maxOrder = existingImagesCount;
    }

    // Create Image record in database with order
    // If order calculation failed, create without order (will be null)
    // Use prisma directly to ensure we're using the latest schema
    const imageData: {
      path: string;
      alt: string;
      modelId: number;
      order?: number;
    } = {
      path: relativePath,
      alt: model.castingName,
      modelId: model.id,
    };
    
    // Only add order if we successfully calculated it
    if (maxOrder !== undefined) {
      imageData.order = maxOrder;
    }
    
    // Use prisma directly instead of createImage to ensure latest schema
    console.log('[IMAGE SAVE] Creating database record with data:', JSON.stringify(imageData, null, 2));
    let imageRecord;
    try {
      imageRecord = await prisma.image.create({
        data: imageData,
      });
      console.log('[IMAGE SAVE] ✅ Image record created successfully:', imageRecord.id, 'with order:', maxOrder);
      console.log('[IMAGE SAVE] Image record details:', JSON.stringify(imageRecord, null, 2));
    } catch (dbError) {
      console.error('[IMAGE SAVE] ❌ Database error:', dbError);
      console.error('[IMAGE SAVE] Error details:', dbError instanceof Error ? dbError.message : String(dbError));
      throw dbError;
    }

    // Update Model.mainImageId ONLY if this is the first image
    // If model already has images OR has a mainImageId, add this as 2nd, 3rd, etc. image without changing mainImageId
    if (!model.mainImageId && existingImagesCount === 0) {
      // This is the first image - set as main image
      await prisma.model.update({
        where: { id: model.id },
        data: { mainImageId: imageRecord.id },
      });
      console.log('Set as main image (first image)');
    } else {
      // Model already has images or mainImageId - add as additional image
      console.log(`Added as additional image (${existingImagesCount + 1}th image). Main image unchanged.`);
    }

    // Clear search cache for this model
    clearModelSearchCache(modelId);

    // Revalidate relevant paths
    revalidatePath('/model-search');
    revalidatePath('/variants');
    revalidatePath(`/models/${modelId}`);

    console.log('[IMAGE SAVE] ✅ Success! Returning response with image:', {
      id: imageRecord.id,
      path: imageRecord.path,
      alt: imageRecord.alt,
    });

    return NextResponse.json({
      success: true,
      image: {
        id: imageRecord.id,
        path: imageRecord.path,
        alt: imageRecord.alt,
      },
      message: 'Image saved successfully',
    });
  } catch (error) {
    console.error('Error in image save API:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    if (error instanceof Error) {
      // Check for specific error messages
      if (error.message.includes('Invalid image URL')) {
        return NextResponse.json(
          {
            error: 'Invalid image URL',
            message: error.message,
          },
          { status: 400 }
        );
      }

      if (error.message.includes('Unsupported image format')) {
        return NextResponse.json(
          {
            error: 'Unsupported image format',
            message: error.message,
          },
          { status: 400 }
        );
      }

      if (error.message.includes('Failed to download')) {
        return NextResponse.json(
          {
            error: 'Failed to download image',
            message: error.message,
          },
          { status: 500 }
        );
      }

      // Return detailed error for debugging
      return NextResponse.json(
        {
          error: 'Failed to save image',
          message: error.message,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}

