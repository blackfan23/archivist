import { spawn } from 'child_process';
import { access, constants } from 'fs/promises';
import { platform } from 'os';

/**
 * Service to handle VLC media player integration.
 */
export class VlcService {
  /**
   * Checks if VLC is installed at the default location or a custom path.
   */
  static async isInstalled(customPath?: string): Promise<boolean> {
    const vlcPath = customPath || this.getDefaultPath();
    if (!vlcPath) return false;

    try {
      await access(vlcPath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Launches VLC to play the specified file.
   */
  static async play(filePath: string, customPath?: string): Promise<void> {
    const vlcPath = customPath || this.getDefaultPath();
    if (!vlcPath) {
      throw new Error('VLC path not found');
    }

    const binaryPath = this.getBinaryPath(vlcPath);

    // Spawn VLC process
    const vlcProcess = spawn(binaryPath, [filePath], {
      detached: true,
      stdio: 'ignore',
    });

    vlcProcess.unref();
  }

  /**
   * Returns the default VLC installation path based on the OS.
   */
  private static getDefaultPath(): string {
    const os = platform();
    if (os === 'darwin') {
      return '/Applications/VLC.app';
    } else if (os === 'win32') {
      return 'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe';
    }
    return 'vlc'; // Assume it's in PATH for Linux
  }

  /**
   * Resolves the actual binary path from the installation path.
   * On Mac, this is inside the .app bundle.
   */
  private static getBinaryPath(installPath: string): string {
    if (platform() === 'darwin' && installPath.endsWith('.app')) {
      return `${installPath}/Contents/MacOS/VLC`;
    }
    return installPath;
  }
}
