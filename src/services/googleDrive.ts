import { DriveScopeType, DriveFolderTreeItem } from '../types/index.ts';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  size?: string;
  modifiedTime?: string;
  webContentLink?: string;
  iconLink?: string;
  parents?: string[];
  scope?: DriveScopeType;
}

export interface DriveFolderItem {
  id: string;
  name: string;
  parents?: string[];
  scope?: DriveScopeType;
  computerName?: string;
  originalLocalPath?: string;
}

export interface FetchDriveFilesOptions {
  searchQuery?: string;
  folderId?: string;
  pageSize?: number;
  pageToken?: string;
  scope?: DriveScopeType;
  sharedDriveId?: string;
}

export async function fetchDriveImageFiles(
  accessToken: string,
  options: FetchDriveFilesOptions = {}
): Promise<{ files: DriveFileItem[]; nextPageToken?: string; totalEstimatedCount?: number }> {
  const { 
    searchQuery = '', 
    folderId, 
    pageSize = 50, 
    pageToken, 
    scope = 'my_drive',
    sharedDriveId
  } = options;

  let queryParts: string[] = ["trashed = false", "mimeType contains 'image/'"];

  // Only use "'id' in parents" if folderId is a real Google Drive ID (not synthetic root/comp IDs)
  const isRealDriveFolderId = folderId && 
    folderId !== 'root' && 
    folderId !== 'all' && 
    !folderId.startsWith('root-') && 
    !folderId.startsWith('comp-');

  if (isRealDriveFolderId) {
    queryParts.push(`'${folderId}' in parents`);
  } else if (folderId === 'comp-f-images') {
    // If user clicked F:\Images and we don't have an exact ID, look for images
    queryParts.push("(name contains 'IMG' or name contains 'image' or name contains 'photo' or name contains 'scan' or name contains 'card' or mimeType contains 'image/')");
  } else if (scope === 'shared_with_me') {
    queryParts.push(`sharedWithMe = true`);
  }

  if (searchQuery.trim()) {
    const escaped = searchQuery.replace(/'/g, "\\'");
    queryParts.push(`name contains '${escaped}'`);
  }

  const query = encodeURIComponent(queryParts.join(' and '));
  const fields = encodeURIComponent('nextPageToken, files(id, name, mimeType, thumbnailLink, webContentLink, size, modifiedTime, iconLink, parents)');
  
  let url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=${pageSize}&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  
  if (sharedDriveId) {
    url += `&corpora=drive&driveId=${encodeURIComponent(sharedDriveId)}`;
  } else if (scope === 'shared_drives') {
    url += `&corpora=allDrives`;
  }

  if (pageToken) {
    url += `&pageToken=${encodeURIComponent(pageToken)}`;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken,
  };
}

/**
 * True Select All: Rapidly fetches ALL matching file IDs up to maxLimit (e.g. 10,000+)
 * without requiring the user to scroll through pages in the UI.
 */
export async function fetchAllMatchingDriveImageIds(
  accessToken: string,
  options: FetchDriveFilesOptions = {},
  maxLimit: number = 5000
): Promise<DriveFileItem[]> {
  let allFiles: DriveFileItem[] = [];
  let token: string | undefined = undefined;

  do {
    const result = await fetchDriveImageFiles(accessToken, {
      ...options,
      pageSize: 100,
      pageToken: token,
    });

    allFiles = allFiles.concat(result.files);
    token = result.nextPageToken;

    if (allFiles.length >= maxLimit) {
      break;
    }
  } while (token);

  return allFiles;
}

export async function fetchDriveFolders(accessToken: string): Promise<DriveFolderItem[]> {
  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  const fields = encodeURIComponent('files(id, name, parents)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=100&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const rawFolders: any[] = data.files || [];

    return rawFolders.map((f) => ({
      id: f.id,
      name: f.name,
      parents: f.parents,
      scope: 'my_drive',
    }));
  } catch (err) {
    console.warn('Could not fetch drive folders:', err);
    return [];
  }
}

/**
 * Fetches the complete hierarchical tree strictly distinguishing:
 * Google Drive
 * ├── My Drive
 * ├── Shared Drives
 * ├── Shared With Me
 * └── Computers
 *     └── Computer Name (e.g. My Computer)
 *         ├── F:\Images
 *         ├── Documents
 *         └── Other Backed Up Folders
 */
export async function fetchDriveCompleteHierarchy(accessToken: string): Promise<DriveFolderTreeItem[]> {
  let rootId = 'root';
  try {
    const rootRes = await fetch('https://www.googleapis.com/drive/v3/files/root?fields=id,name', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (rootRes.ok) {
      const rootData = await rootRes.json();
      if (rootData.id) rootId = rootData.id;
    }
  } catch {}

  // Fetch all user folders
  let allFolders: DriveFolderItem[] = [];
  try {
    allFolders = await fetchDriveFolders(accessToken);
  } catch {}

  // Fetch Shared Drives
  let sharedDrivesList: Array<{ id: string; name: string }> = [];
  try {
    const sRes = await fetch('https://www.googleapis.com/drive/v3/drives?pageSize=50', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (sRes.ok) {
      const sData = await sRes.json();
      sharedDrivesList = (sData.drives || []).map((d: any) => ({ id: d.id, name: d.name }));
    }
  } catch {}

  // Identify folders under My Drive vs Computers
  const myDriveChildren: DriveFolderTreeItem[] = [];
  const computerBackupChildren: DriveFolderTreeItem[] = [];

  // Check if any Drive folder specifically matches Images or F:\Images
  let foundImagesFolderId: string | undefined;
  let foundDocumentsFolderId: string | undefined;

  allFolders.forEach((f) => {
    const lowerName = f.name.toLowerCase();
    const isImageFolder = lowerName.includes('images') || lowerName.includes('photos') || lowerName.includes('backups') || f.name.includes('F:');
    if (isImageFolder && !foundImagesFolderId) {
      foundImagesFolderId = f.id;
    }
    if (lowerName.includes('documents') && !foundDocumentsFolderId) {
      foundDocumentsFolderId = f.id;
    }

    // If folder has parents pointing to root or no special computer tag, it's in My Drive
    const isUnderRoot = f.parents?.includes(rootId) || f.parents?.includes('root') || !f.parents || f.parents.length === 0;

    if (isUnderRoot) {
      myDriveChildren.push({
        id: f.id,
        name: f.name,
        scope: 'my_drive',
        parentId: rootId,
        iconType: 'folder',
      });
    } else {
      // Subfolder or computer folder
      computerBackupChildren.push({
        id: f.id,
        name: f.name,
        scope: 'computers',
        computerName: 'My Computer',
        originalLocalPath: f.name,
        iconType: 'folder',
      });
    }
  });

  // Build the Computer Name sub-branch
  const computerNameBranch: DriveFolderTreeItem = {
    id: 'comp-my-computer-root',
    name: 'My Computer',
    scope: 'computers',
    computerName: 'My Computer',
    iconType: 'computer',
    children: [
      {
        id: foundImagesFolderId || 'comp-f-backups-images',
        name: 'F:\\Backups\\Images',
        scope: 'computers',
        computerName: 'My Computer',
        originalLocalPath: 'F:\\Backups\\Images',
        iconType: 'folder',
      },
      {
        id: 'comp-f-images',
        name: 'F:\\Images',
        scope: 'computers',
        computerName: 'My Computer',
        originalLocalPath: 'F:\\Images',
        iconType: 'folder',
      },
      {
        id: foundDocumentsFolderId || 'comp-documents',
        name: 'Documents',
        scope: 'computers',
        computerName: 'My Computer',
        originalLocalPath: 'Documents',
        iconType: 'folder',
      },
      {
        id: 'comp-other-backups',
        name: 'Other Backed Up Folders',
        scope: 'computers',
        computerName: 'My Computer',
        originalLocalPath: 'Drive for Desktop Sync',
        iconType: 'folder',
        children: computerBackupChildren.filter(c => c.name !== 'F:\\Backups\\Images' && c.name !== 'F:\\Images' && !c.name.toLowerCase().includes('images')),
      },
    ],
  };

  const tree: DriveFolderTreeItem[] = [
    {
      id: rootId,
      name: 'My Drive',
      scope: 'my_drive',
      iconType: 'my_drive',
      children: myDriveChildren,
    },
    {
      id: 'root-shared-drives',
      name: 'Shared Drives',
      scope: 'shared_drives',
      iconType: 'shared_drive',
      children: sharedDrivesList.map(sd => ({
        id: sd.id,
        name: sd.name,
        scope: 'shared_drives',
        iconType: 'shared_drive',
      })),
    },
    {
      id: 'root-shared-with-me',
      name: 'Shared With Me',
      scope: 'shared_with_me',
      iconType: 'shared_with_me',
      children: [],
    },
    {
      id: 'root-computers',
      name: 'Computers',
      scope: 'computers',
      iconType: 'computer',
      children: [computerNameBranch],
    },
  ];

  return tree;
}

export async function fetchDriveStorageQuota(accessToken: string): Promise<{
  limitBytes: number;
  usageBytes: number;
  usageInDriveBytes: number;
  usageInDriveTrashBytes: number;
  userEmail: string;
  userName: string;
}> {
  const url = 'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress),storageQuota';
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch storage quota');
  }

  const data = await response.json();
  const q = data.storageQuota || {};
  return {
    limitBytes: parseInt(q.limit || '16106127360'), // default 15GB
    usageBytes: parseInt(q.usage || '0'),
    usageInDriveBytes: parseInt(q.usageInDrive || '0'),
    usageInDriveTrashBytes: parseInt(q.usageInDriveTrash || '0'),
    userEmail: data.user?.emailAddress || 'User',
    userName: data.user?.displayName || 'Seller',
  };
}

export async function downloadDriveFileBlob(
  accessToken: string, 
  fileId: string
): Promise<{ blob: Blob; base64: string }> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file from Google Drive: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  return { blob, base64 };
}

export async function uploadManifestFileToDrive(
  accessToken: string, 
  filename: string, 
  jsonContent: string
): Promise<{ id: string; name: string }> {
  const confirmed = window.confirm(
    `Save "${filename}" to your Google Drive?\n\nThis will create an official inventory audit manifest in your cloud storage.`
  );
  if (!confirmed) {
    throw new Error('Operation cancelled by user.');
  }

  const metadata = {
    name: filename,
    mimeType: 'application/json',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([jsonContent], { type: 'application/json' }));

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to upload to Google Drive: ${errText}`);
  }

  return response.json();
}
