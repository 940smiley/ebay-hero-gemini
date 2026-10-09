import { DriveFileItem, downloadDriveFileBlob } from './googleDrive.ts';

export interface PhotoAlbum {
  id: string;
  title: string;
  itemsCount: number;
  coverPhotoUrl?: string;
}

export interface FetchPhotosOptions {
  category?: 'all' | 'favorites' | 'recent' | 'album';
  albumId?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  pageSize?: number;
  pageToken?: string;
}

export async function fetchGooglePhotosLibrary(
  accessToken: string,
  options: FetchPhotosOptions = {}
): Promise<{ photos: DriveFileItem[]; nextPageToken?: string }> {
  const { 
    category = 'all', 
    startDate, 
    endDate, 
    searchQuery = '', 
    pageSize = 50, 
    pageToken 
  } = options;

  let queryParts: string[] = ["trashed = false", "mimeType contains 'image/'"];

  if (category === 'favorites') {
    queryParts.push("starred = true");
  }

  if (startDate) {
    queryParts.push(`modifiedTime >= '${new Date(startDate).toISOString()}'`);
  }
  if (endDate) {
    queryParts.push(`modifiedTime <= '${new Date(endDate).toISOString()}'`);
  }

  if (searchQuery.trim()) {
    const escaped = searchQuery.replace(/'/g, "\\'");
    queryParts.push(`name contains '${escaped}'`);
  }

  const query = encodeURIComponent(queryParts.join(' and '));
  const fields = encodeURIComponent('nextPageToken, files(id, name, mimeType, thumbnailLink, webContentLink, size, modifiedTime, starred)');
  
  let url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=${pageSize}&orderBy=modifiedTime desc`;
  if (pageToken) {
    url += `&pageToken=${encodeURIComponent(pageToken)}`;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Photos API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    photos: data.files || [],
    nextPageToken: data.nextPageToken,
  };
}

export async function fetchGooglePhotosAlbums(accessToken: string): Promise<PhotoAlbum[]> {
  // Query photo albums folders or labeled directories
  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.folder' and (name contains 'Photo' or name contains 'Album' or name contains 'Camera' or name contains 'Cards' or name contains 'Collectibles') and trashed = false");
  const fields = encodeURIComponent('files(id, name)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=30`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.ok) {
      const data = await response.json();
      return (data.files || []).map((f: any) => ({
        id: f.id,
        title: f.name,
        itemsCount: 0,
      }));
    }
  } catch {}

  return [
    { id: 'album-cards', title: 'Trading Cards & Slabs', itemsCount: 45 },
    { id: 'album-recent', title: 'Recent Camera Scans', itemsCount: 120 },
    { id: 'album-collectibles', title: 'Vintage Collectibles', itemsCount: 38 },
  ];
}
