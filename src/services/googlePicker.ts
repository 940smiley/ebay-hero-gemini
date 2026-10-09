declare const google: any;
declare const gapi: any;

let isGapiLoaded = false;
let isPickerLoaded = false;

export function loadGooglePickerApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();

    if (isPickerLoaded && typeof google !== 'undefined' && google.picker) {
      return resolve();
    }

    if (!isGapiLoaded) {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        isGapiLoaded = true;
        gapi.load('picker', {
          callback: () => {
            isPickerLoaded = true;
            resolve();
          },
          onerror: reject,
        });
      };
      script.onerror = reject;
      document.body.appendChild(script);
    } else {
      gapi.load('picker', {
        callback: () => {
          isPickerLoaded = true;
          resolve();
        },
        onerror: reject,
      });
    }
  });
}

export interface PickedGoogleDoc {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  sizeBytes?: number;
}

export function openGoogleDrivePicker(
  accessToken: string,
  onPick: (docs: PickedGoogleDoc[]) => void,
  onCancel?: () => void
) {
  if (typeof google === 'undefined' || !google.picker) {
    throw new Error('Google Picker library is not loaded. Call loadGooglePickerApi() first.');
  }

  const pickerOrigin =
    (window.location as any).ancestorOrigins &&
    (window.location as any).ancestorOrigins.length > 0
      ? (window.location as any).ancestorOrigins[(window.location as any).ancestorOrigins.length - 1]
      : window.location.origin;

  const docsView = new google.picker.DocsView()
    .setIncludeFolders(true)
    .setMimeTypes('image/jpeg,image/png,image/webp,image/heic,image/gif');

  const photosView = new google.picker.ViewId.PHOTOS
    ? new google.picker.DocsView(google.picker.ViewId.PHOTOS)
    : docsView;

  const picker = new google.picker.PickerBuilder()
    .addView(docsView)
    .addView(photosView)
    .addView(new google.picker.DocsUploadView())
    .setOAuthToken(accessToken)
    .setOrigin(pickerOrigin)
    .setCallback((data: any) => {
      if (data.action === google.picker.Action.PICKED) {
        const picked = (data.docs || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          mimeType: d.mimeType,
          url: d.url || '',
          sizeBytes: d.sizeBytes,
        }));
        onPick(picked);
      } else if (data.action === google.picker.Action.CANCEL) {
        if (onCancel) onCancel();
      }
    })
    .build();

  picker.setVisible(true);
}
