import { GameState } from './types';

declare var google: any;

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const HARDCODED_CLIENT_ID = "346539753968-13bm2liqaj4qo64hgvoaohri0u5g0his.apps.googleusercontent.com"; 
const FILE_NAME = 'chronicles_of_amara_ledger.json';

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

export class GoogleDriveService {
  private static accessToken: string | null = null;
  private static tokenClient: any = null;
  private static isInitialized: boolean = false;

  static getClientId(): string {
    const stored = localStorage.getItem('amara_gdrive_client_id');
    return (stored || HARDCODED_CLIENT_ID).trim();
  }

  static async init(onLoaded: () => void) {
    const checkGis = () => {
      if (typeof google !== 'undefined' && google.accounts?.oauth2) {
        this.isInitialized = true;
        this.ensureTokenClient();
        onLoaded();
      } else {
        setTimeout(checkGis, 200);
      }
    };
    checkGis();
  }

  private static ensureTokenClient(): boolean {
    if (this.tokenClient) return true;
    const cid = this.getClientId();
    if (!cid || cid.length < 10) return false;

    try {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: cid,
        scope: SCOPES,
        callback: (resp: any) => {
          if (resp.error) {
            console.error("GIS Token Auth Error:", resp.error);
            return;
          }
          this.accessToken = resp.access_token;
          localStorage.setItem('amara_gdrive_auth', 'true');
        },
      });
      return true;
    } catch (e) {
      console.error("GIS Initialization Failed:", e);
      return false;
    }
  }

  static hasPreviousAuth(): boolean {
    return localStorage.getItem('amara_gdrive_auth') === 'true';
  }

  static async authenticate(silent = false): Promise<{success: boolean, error?: string}> {
    if (!this.ensureTokenClient()) return { success: false, error: "GIS not initialized" };
    
    return new Promise((resolve) => {
      this.tokenClient.callback = (resp: any) => {
        if (resp.error) {
          console.error("OAuth callback error:", resp.error_description || resp.error);
          resolve({ success: false, error: resp.error_description || resp.error });
        } else {
          this.accessToken = resp.access_token;
          localStorage.setItem('amara_gdrive_auth', 'true');
          resolve({ success: true });
        }
      };
      
      try {
        if (silent) {
          // Note: prompt 'none' often fails without active user session
          this.tokenClient.requestAccessToken({ prompt: 'none' });
        } else {
          this.tokenClient.requestAccessToken({ prompt: 'select_account' });
        }
      } catch (e: any) {
        console.error("Auth Request Exception:", e);
        resolve({ success: false, error: e.message });
      }
    });
  }

  private static async apiRequest(url: string, options: RequestInit = {}, retryOnAuth = true): Promise<Response> {
    if (!this.accessToken) {
      const auth = await this.authenticate(true);
      if (!auth.success) throw new Error("Authentication failed during request.");
    }

    const headers = {
      ...options.headers,
      Authorization: `Bearer ${this.accessToken}`,
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 && retryOnAuth) {
      const auth = await this.authenticate(true);
      if (auth.success) {
        return this.apiRequest(url, options, false);
      }
    }

    return response;
  }

  static async findAllSaveFiles(): Promise<DriveFile[]> {
    try {
      // DRIVE_FILE scope should find files created by THIS app across any browser.
      const q = encodeURIComponent(`name = '${FILE_NAME}' and trashed = false`);
      const response = await this.apiRequest(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id, name, modifiedTime)&orderBy=modifiedTime desc`
      );
      if (!response.ok) {
        const errText = await response.text();
        console.error("Drive Search API Failure:", errText);
        return [];
      }
      const data = await response.json();
      console.log(`Drive: Found ${data.files?.length || 0} files named ${FILE_NAME}`);
      return data.files || [];
    } catch (e) {
      console.error("findAllSaveFiles unexpected error:", e);
      return [];
    }
  }

  static async loadFromCloud(): Promise<GameState | null> {
    try {
      const files = await this.findAllSaveFiles();
      if (files.length === 0) {
        console.warn("Cloud: Search returned zero files. Ensure same Google account and App Scope.");
        return null;
      }

      const latestFileId = files[0].id;
      const response = await this.apiRequest(
        `https://www.googleapis.com/drive/v3/files/${latestFileId}?alt=media&t=${Date.now()}`
      );
      
      if (!response.ok) {
        console.error("Cloud Media Download Failure:", await response.text());
        return null;
      }
      
      const content = await response.json();
      console.log("Cloud: Successfully downloaded state from", latestFileId);
      return content;
    } catch (e) {
      console.error("loadFromCloud exception:", e);
      return null;
    }
  }

  private static async cleanupDuplicates(keptId: string, allFiles: DriveFile[]) {
    const duplicates = allFiles.filter(f => f.id !== keptId);
    if (duplicates.length === 0) return;

    await Promise.all(duplicates.map(async (file) => {
      try {
        await this.apiRequest(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
          method: 'DELETE'
        });
      } catch (e) {
        console.warn("Clean-up deletion failed for", file.id);
      }
    }));
  }

  static async saveToCloud(state: GameState): Promise<boolean> {
    try {
      const existingFiles = await this.findAllSaveFiles();
      const targetFile = existingFiles.length > 0 ? existingFiles[0] : null;

      const metadata = { name: FILE_NAME, mimeType: 'application/json' };
      const boundary = '-------amara_sync_boundary';
      const body = 
        `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\n` +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(state) +
        `\r\n--${boundary}--`;

      let url: string;
      let method: string;

      if (targetFile) {
        url = `https://www.googleapis.com/upload/drive/v3/files/${targetFile.id}?uploadType=multipart`;
        method = 'PATCH';
        console.log("Cloud: Attempting to PATCH existing file", targetFile.id);
      } else {
        url = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
        method = 'POST';
        console.log("Cloud: Creating a NEW file entry.");
      }

      const response = await this.apiRequest(url, {
        method,
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: body
      });

      if (response.ok) {
        const savedFile = await response.json();
        console.log("Cloud: Save successful.", savedFile.id);
        if (existingFiles.length > 1) {
          await this.cleanupDuplicates(savedFile.id || targetFile!.id, existingFiles);
        }
        return true;
      }
      
      const err = await response.text();
      console.error("Cloud Save API Failed:", err);
      return false;
    } catch (e) {
      console.error("saveToCloud exception:", e);
      return false;
    }
  }
}