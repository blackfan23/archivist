import { computed, inject, Injectable } from '@angular/core';
import { SettingsService } from './settings.service';

const APP_TITLE = 'Archivist';

// Translation dictionary type
export type TranslationKey = keyof (typeof TRANSLATIONS)['en'];

// Translations for supported languages
const TRANSLATIONS = {
  en: {
    // Header
    'app.title': APP_TITLE,
    'app.settings': 'Settings',

    // Scan controls
    'scan.folder': 'Scan Folder',
    'scan.rescan': 'Update',
    'scan.cancel': 'Cancel',
    'scan.clear': 'Clear Library',
    'scan.scanning': 'Scanning:',
    'scan.lastScan': 'Last scan:',
    'scan.files': 'files',
    'scan.errors': 'errors',
    'scan.errorList': 'Scan Errors',
    'scan.noErrors': 'No errors',

    // Filters
    'filter.filters': 'Filters',
    'filter.clearAll': 'Clear all',
    'filter.search': 'Search',
    'filter.searchPlaceholder': 'Search files...',
    'filter.resolution': 'Resolution',
    'filter.audio': 'Audio',
    'filter.audioLanguage': 'Audio Language',
    'filter.codec': 'Video Codec',
    'filter.bitrate': 'Bitrate',
    'filter.customBitrate': 'Custom (Mbps):',
    'filter.reset': 'Reset Filters',

    // Stats
    'stats.of': 'of',
    'stats.files': 'files',

    // Table
    'table.filename': 'Filename',
    'table.resolution': 'Resolution',
    'table.audio': 'Audio',
    'table.duration': 'Duration',
    'table.bitrate': 'Bitrate',
    'table.size': 'Size',
    'table.modified': 'Modified',
    'table.noFiles': 'No media files',
    'table.scanToStart': 'Click "Scan Folder" to select a directory',
    'table.loadingLibrary': 'Loading library...',
    'table.scanningMedia': 'Scanning media files...',

    // Selection actions
    'action.selected': 'selected',
    'action.moveTo': 'Move to...',
    'action.delete': 'Delete',
    'action.deleteSeason': 'Delete Season',
    'action.showInFinder': 'Show in Finder',
    'action.rename': 'Rename',
    'action.renameFolder': 'Rename Folder',
    'action.clearSelection': 'Clear selection',
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.enterNewName': 'Enter new name...',
    'action.useFolderName': 'Use Folder Name',
    'action.useFolderNameHint':
      'Use the containing folder name as the file name',
    'action.requeryRating': 'Requery Rating',

    // Settings
    'settings.title': 'Settings',
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme',
    'settings.themeDark': 'Dark',
    'settings.themeLight': 'Light',
    'settings.language': 'Language',
    'settings.behavior': 'Behavior',
    'settings.alwaysDeleteFolder': 'Always delete enclosing folder',
    'settings.alwaysDeleteFolderDesc':
      'Automatically remove empty parent folders when deleting files',
    'settings.close': 'Close',
    'settings.integrations': 'Integrations',
    'settings.ratingProvider': 'Data Provider',
    'settings.ratingProviderDesc': 'Choose where to fetch movie ratings from.',
    'settings.omdbApiKey': 'OMDB API Key',
    'settings.tmdbApiKey': 'TMDB API Key',
    'settings.getKeyFrom': 'Get your key from',
    'settings.enterApiKey': 'Enter API Key',

    // Confirmations
    'confirm.deleteFiles': 'Delete selected files?',
    'confirm.cannotUndo': 'This action cannot be undone.',
    'confirm.deleteFolders': 'Delete enclosing folder(s)?',
    'confirm.deleteFoldersDesc':
      'Do you want to also delete the parent folder(s) if they are now empty?',
    'confirm.yes': 'Yes',
    'confirm.no': 'No',
    'confirm.delete': 'Delete',
    'confirm.deleteSeason': 'Delete entire season?',
    'confirm.deleteSeasonDesc':
      'All files in the same folders as the selected files will be deleted. This action cannot be undone.',
    'confirm.cancel': 'Cancel',

    // TMDB Match
    'action.matchToTmdb': 'Match to TMDB',
    'match.title': 'Match to Database',
    'match.searchPlaceholder': 'Search movie or TV show...',
    'match.season': 'Season',
    'match.episode': 'Episode',
    'match.noResults': 'No results found',
    'match.searching': 'Searching...',
    'match.newFilename': 'New filename',
    'match.embedMetadata': 'Embed metadata in file',
    'match.processing': 'Processing...',

    // Metadata
    'metadata.dialogTitle': 'Write Metadata',
    'metadata.type': 'Type',
    'metadata.show': 'Show Name',
    'metadata.titleField': 'Title',
    'metadata.description': 'Description',
    'metadata.writeSuccess': 'Metadata written successfully',
    'metadata.writeError': 'Failed to write metadata',
    'action.writeMetadata': 'Write Metadata',
    'match.year': 'Year',

    // Notifications
    'notify.deleteSuccess': 'Deleted {count} file(s)',
    'notify.deleteError': 'Failed to delete some files',
    'notify.moveSuccess': 'Moved {count} file(s)',
    'notify.moveError': 'Failed to move some files',
    'notify.renameSuccess': 'Renamed successfully',
    'notify.renameError': 'Failed to rename',
    'notify.matchSuccess': 'File matched successfully',
    'notify.matchError': 'Failed to match file',
    'notify.seasonDeleteSuccess': 'Season deleted',
    'notify.backendError': 'Error: {message}',
    'notify.noTmdbApiKey':
      'TMDB API key not configured. Go to Settings to add your API key. Get one free at themoviedb.org',

    // Error Log
    'errorLog.title': 'Error Log',
    'errorLog.noErrors': 'No errors recorded',
    'errorLog.clear': 'Clear All',
    'action.close': 'Close',

    // Queue
    'queue.title': 'Match Queue',
    'queue.addToQueue': 'Add to Queue',
    'queue.processQueue': 'Process Queue',
    'queue.clearQueue': 'Clear All',
    'queue.clearFinished': 'Clear Finished',
    'queue.rescanAfter': 'Rescan library after completion',
    'queue.processing': 'Processing...',
    'queue.empty': 'Queue is empty',
    'queue.itemAdded': 'Added to queue',
    'queue.completed': 'Queue completed',

    // Editor
    'action.edit': 'Edit',
    'editor.title': 'FFmpeg Editor',
    'editor.backToLibrary': 'Back to Library',
    'editor.loading': 'Loading file...',
    'editor.fileNotFound': 'File not found',
    'editor.containerConversion': 'Container Conversion',
    'editor.containerDesc': 'Convert to a different container format without re-encoding.',
    'editor.videoTranscoding': 'Video Transcoding',
    'editor.videoDesc': 'Re-encode video with different codec and quality settings.',
    'editor.audioTranscoding': 'Audio Transcoding',
    'editor.audioDesc': 'Re-encode audio with different codec and bitrate.',
    'editor.subtitles': 'Subtitles',
    'editor.subtitlesDesc': 'Extract, add, or remove subtitle tracks.',
    'editor.customCommand': 'Custom Command',
    'editor.customDesc': 'Run a custom FFmpeg command. Do not include "ffmpeg" prefix.',
    'editor.convert': 'Convert',
    'editor.transcode': 'Transcode',
    'editor.codec': 'Codec',
    'editor.quality': 'Quality',
    'editor.preset': 'Preset',
    'editor.bitrate': 'Bitrate',
    'editor.extract': 'Extract',
    'editor.remove': 'Remove',
    'editor.addSubtitle': 'Add Subtitle File',
    'editor.noSubtitles': 'No subtitle tracks in this file.',
    'editor.history': 'Recent Commands',
    'editor.selectPrevious': 'Select a previous command...',
    'editor.command': 'FFmpeg Arguments',
    'editor.execute': 'Execute',
    'editor.processing': 'Processing...',
    'editor.success': 'Completed',
    'editor.error': 'Error',
  },
  sv: {
    // Header
    'app.title': APP_TITLE,
    'app.settings': 'Inställningar',

    // Scan controls
    'scan.folder': 'Skanna Mapp',
    'scan.rescan': 'Uppdatera',
    'scan.cancel': 'Avbryt',
    'scan.clear': 'Rensa Bibliotek',
    'scan.scanning': 'Skannar:',
    'scan.lastScan': 'Senaste skanning:',
    'scan.files': 'filer',
    'scan.errors': 'fel',
    'scan.errorList': 'Skanningsfel',
    'scan.noErrors': 'Inga fel',

    // Filters
    'filter.filters': 'Filter',
    'filter.clearAll': 'Rensa alla',
    'filter.search': 'Sök',
    'filter.searchPlaceholder': 'Sök filer...',
    'filter.resolution': 'Upplösning',
    'filter.audio': 'Ljud',
    'filter.audioLanguage': 'Ljudspråk',
    'filter.codec': 'Video Codec',
    'filter.bitrate': 'Bitrate',
    'filter.customBitrate': 'Anpassad (Mbps):',
    'filter.reset': 'Återställ Filter',

    // Stats
    'stats.of': 'av',
    'stats.files': 'filer',

    // Table
    'table.filename': 'Filnamn',
    'table.resolution': 'Upplösning',
    'table.audio': 'Ljud',
    'table.duration': 'Längd',
    'table.bitrate': 'Bitrate',
    'table.size': 'Storlek',
    'table.modified': 'Ändrad',
    'table.noFiles': 'Inga mediefiler',
    'table.scanToStart': 'Klicka på "Skanna Mapp" för att välja en katalog',
    'table.loadingLibrary': 'Laddar bibliotek...',
    'table.scanningMedia': 'Skannar mediefiler...',

    // Selection actions
    'action.selected': 'valda',
    'action.moveTo': 'Flytta till...',
    'action.delete': 'Radera',
    'action.deleteSeason': 'Radera Säsong',
    'action.showInFinder': 'Visa i Finder',
    'action.rename': 'Byt namn',
    'action.renameFolder': 'Byt mappnamn',
    'action.clearSelection': 'Rensa val',
    'action.save': 'Spara',
    'action.cancel': 'Avbryt',
    'action.enterNewName': 'Ange nytt namn...',
    'action.useFolderName': 'Använd mappnamn',
    'action.useFolderNameHint':
      'Använd den omslutande mappens namn som filnamn',
    'action.requeryRating': 'Uppdatera betyg',

    // Settings
    'settings.title': 'Inställningar',
    'settings.appearance': 'Utseende',
    'settings.theme': 'Tema',
    'settings.themeDark': 'Mörkt',
    'settings.themeLight': 'Ljust',
    'settings.language': 'Språk',
    'settings.behavior': 'Beteende',
    'settings.alwaysDeleteFolder': 'Radera alltid omslutande mapp',
    'settings.alwaysDeleteFolderDesc':
      'Ta automatiskt bort tomma överordnade mappar vid filborttagning',
    'settings.close': 'Stäng',
    'settings.integrations': 'Integrationer',
    'settings.ratingProvider': 'Dataleverantör',
    'settings.ratingProviderDesc': 'Välj varifrån filmbetyg ska hämtas.',
    'settings.omdbApiKey': 'OMDB API-nyckel',
    'settings.tmdbApiKey': 'TMDB API-nyckel',
    'settings.getKeyFrom': 'Skaffa din nyckel från',
    'settings.enterApiKey': 'Ange API-nyckel',

    // Confirmations
    'confirm.deleteFiles': 'Radera valda filer?',
    'confirm.cannotUndo': 'Denna åtgärd kan inte ångras.',
    'confirm.deleteFolders': 'Radera omslutande mapp(ar)?',
    'confirm.deleteFoldersDesc':
      'Vill du även radera överordnade mapp(ar) om de nu är tomma?',
    'confirm.yes': 'Ja',
    'confirm.no': 'Nej',
    'confirm.delete': 'Radera',
    'confirm.deleteSeason': 'Radera hela säsongen?',
    'confirm.deleteSeasonDesc':
      'Alla filer i samma mappar som de markerade filerna kommer att raderas. Denna åtgärd kan inte ångras.',
    'confirm.cancel': 'Avbryt',

    // TMDB Match
    'action.matchToTmdb': 'Matcha mot TMDB',
    'match.title': 'Matcha mot databas',
    'match.searchPlaceholder': 'Sök film eller TV-serie...',
    'match.season': 'Säsong',
    'match.episode': 'Avsnitt',
    'match.noResults': 'Inga resultat hittades',
    'match.searching': 'Söker...',
    'match.newFilename': 'Nytt filnamn',
    'match.embedMetadata': 'Bädda in metadata i fil',
    'match.processing': 'Bearbetar...',

    // Metadata
    'metadata.dialogTitle': 'Skriv metadata',
    'metadata.type': 'Typ',
    'metadata.show': 'Programnamn',
    'metadata.titleField': 'Titel',
    'metadata.description': 'Beskrivning',
    'metadata.writeSuccess': 'Metadata skrevs',
    'metadata.writeError': 'Misslyckades att skriva metadata',
    'action.writeMetadata': 'Skriv Metadata',
    'match.year': 'År',

    // Notifications
    'notify.deleteSuccess': 'Raderade {count} fil(er)',
    'notify.deleteError': 'Kunde inte radera vissa filer',
    'notify.moveSuccess': 'Flyttade {count} fil(er)',
    'notify.moveError': 'Kunde inte flytta vissa filer',
    'notify.renameSuccess': 'Namn ändrat',
    'notify.renameError': 'Kunde inte byta namn',
    'notify.matchSuccess': 'Fil matchad',
    'notify.matchError': 'Kunde inte matcha fil',
    'notify.seasonDeleteSuccess': 'Säsong raderad',
    'notify.backendError': 'Fel: {message}',
    'notify.noTmdbApiKey':
      'TMDB API-nyckel saknas. Gå till Inställningar för att lägga till din nyckel. Skaffa en gratis på themoviedb.org',

    // Error Log
    'errorLog.title': 'Fellogg',
    'errorLog.noErrors': 'Inga fel registrerade',
    'errorLog.clear': 'Rensa allt',
    'action.close': 'Stäng',

    // Queue
    'queue.title': 'Matchningskö',
    'queue.addToQueue': 'Lägg till i kö',
    'queue.processQueue': 'Kör kön',
    'queue.clearQueue': 'Rensa allt',
    'queue.clearFinished': 'Rensa klara',
    'queue.rescanAfter': 'Skanna om biblioteket efter körning',
    'queue.processing': 'Bearbetar...',
    'queue.empty': 'Kön är tom',
    'queue.itemAdded': 'Tillagd i kön',
    'queue.completed': 'Kön klar',

    // Editor
    'action.edit': 'Redigera',
    'editor.title': 'FFmpeg-redigerare',
    'editor.backToLibrary': 'Tillbaka till biblioteket',
    'editor.loading': 'Laddar fil...',
    'editor.fileNotFound': 'Fil hittades inte',
    'editor.containerConversion': 'Containerkonvertering',
    'editor.containerDesc': 'Konvertera till ett annat containerformat utan omkodning.',
    'editor.videoTranscoding': 'Videotranskodning',
    'editor.videoDesc': 'Koda om video med annan codec och kvalitet.',
    'editor.audioTranscoding': 'Ljudtranskodning',
    'editor.audioDesc': 'Koda om ljud med annan codec och bitrate.',
    'editor.subtitles': 'Undertexter',
    'editor.subtitlesDesc': 'Extrahera, lägg till eller ta bort undertextspår.',
    'editor.customCommand': 'Anpassat kommando',
    'editor.customDesc': 'Kör ett anpassat FFmpeg-kommando. Inkludera inte "ffmpeg" prefix.',
    'editor.convert': 'Konvertera',
    'editor.transcode': 'Koda om',
    'editor.codec': 'Codec',
    'editor.quality': 'Kvalitet',
    'editor.preset': 'Preset',
    'editor.bitrate': 'Bitrate',
    'editor.extract': 'Extrahera',
    'editor.remove': 'Ta bort',
    'editor.addSubtitle': 'Lägg till undertextfil',
    'editor.noSubtitles': 'Inga undertextspår i denna fil.',
    'editor.history': 'Senaste kommandon',
    'editor.selectPrevious': 'Välj ett tidigare kommando...',
    'editor.command': 'FFmpeg-argument',
    'editor.execute': 'Kör',
    'editor.processing': 'Bearbetar...',
    'editor.success': 'Slutfört',
    'editor.error': 'Fel',
  },
  de: {
    // Header
    'app.title': APP_TITLE,
    'app.settings': 'Einstellungen',

    // Scan controls
    'scan.folder': 'Ordner scannen',
    'scan.rescan': 'Aktualisieren',
    'scan.cancel': 'Abbrechen',
    'scan.clear': 'Bibliothek leeren',
    'scan.scanning': 'Scanne:',
    'scan.lastScan': 'Letzter Scan:',
    'scan.files': 'Dateien',
    'scan.errors': 'Fehler',
    'scan.errorList': 'Scan-Fehler',
    'scan.noErrors': 'Keine Fehler',

    // Filters
    'filter.filters': 'Filter',
    'filter.clearAll': 'Alle löschen',
    'filter.search': 'Suche',
    'filter.searchPlaceholder': 'Dateien suchen...',
    'filter.resolution': 'Auflösung',
    'filter.audio': 'Audio',
    'filter.audioLanguage': 'Audiosprache',
    'filter.codec': 'Video Codec',
    'filter.bitrate': 'Bitrate',
    'filter.customBitrate': 'Benutzerdefiniert (Mbps):',
    'filter.reset': 'Filter zurücksetzen',

    // Stats
    'stats.of': 'von',
    'stats.files': 'Dateien',

    // Table
    'table.filename': 'Dateiname',
    'table.resolution': 'Auflösung',
    'table.audio': 'Audio',
    'table.duration': 'Dauer',
    'table.bitrate': 'Bitrate',
    'table.size': 'Größe',
    'table.modified': 'Geändert',
    'table.noFiles': 'Keine Mediendateien',
    'table.scanToStart':
      'Klicken Sie auf "Ordner scannen" um ein Verzeichnis auszuwählen',
    'table.loadingLibrary': 'Bibliothek wird geladen...',
    'table.scanningMedia': 'Mediendateien werden gescannt...',

    // Selection actions
    'action.selected': 'ausgewählt',
    'action.moveTo': 'Verschieben nach...',
    'action.delete': 'Löschen',
    'action.deleteSeason': 'Staffel löschen',
    'action.showInFinder': 'Im Finder anzeigen',
    'action.rename': 'Umbenennen',
    'action.renameFolder': 'Ordner umbenennen',
    'action.clearSelection': 'Auswahl aufheben',
    'action.save': 'Speichern',
    'action.cancel': 'Abbrechen',
    'action.enterNewName': 'Neuen Namen eingeben...',
    'action.useFolderName': 'Ordnernamen verwenden',
    'action.useFolderNameHint':
      'Den Namen des übergeordneten Ordners als Dateinamen verwenden',
    'action.requeryRating': 'Bewertung aktualisieren',

    // Settings
    'settings.title': 'Einstellungen',
    'settings.appearance': 'Erscheinungsbild',
    'settings.theme': 'Design',
    'settings.themeDark': 'Dunkel',
    'settings.themeLight': 'Hell',
    'settings.language': 'Sprache',
    'settings.behavior': 'Verhalten',
    'settings.alwaysDeleteFolder': 'Übergeordneten Ordner immer löschen',
    'settings.alwaysDeleteFolderDesc':
      'Leere übergeordnete Ordner beim Löschen von Dateien automatisch entfernen',
    'settings.close': 'Schließen',
    'settings.integrations': 'Integrationen',
    'settings.ratingProvider': 'Datemquelle',
    'settings.ratingProviderDesc':
      'Wählen Sie, woher Filmbewertungen abgerufen werden.',
    'settings.omdbApiKey': 'OMDB API-Schlüssel',
    'settings.tmdbApiKey': 'TMDB API-Schlüssel',
    'settings.getKeyFrom': 'Erhalten Sie Ihren Schlüssel von',
    'settings.enterApiKey': 'API-Schlüssel eingeben',

    // Confirmations
    'confirm.deleteFiles': 'Ausgewählte Dateien löschen?',
    'confirm.cannotUndo': 'Diese Aktion kann nicht rückgängig gemacht werden.',
    'confirm.deleteFolders': 'Übergeordnete(n) Ordner löschen?',
    'confirm.deleteFoldersDesc':
      'Möchten Sie auch die übergeordneten Ordner löschen, wenn sie jetzt leer sind?',
    'confirm.yes': 'Ja',
    'confirm.no': 'Nein',
    'confirm.delete': 'Löschen',
    'confirm.deleteSeason': 'Ganze Staffel löschen?',
    'confirm.deleteSeasonDesc':
      'Alle Dateien in denselben Ordnern wie die ausgewählten Dateien werden gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
    'confirm.cancel': 'Abbrechen',

    // TMDB Match
    'action.matchToTmdb': 'Mit TMDB abgleichen',
    'match.title': 'Mit Datenbank abgleichen',
    'match.searchPlaceholder': 'Film oder Serie suchen...',
    'match.season': 'Staffel',
    'match.episode': 'Folge',
    'match.noResults': 'Keine Ergebnisse gefunden',
    'match.searching': 'Suche...',
    'match.newFilename': 'Neuer Dateiname',
    'match.embedMetadata': 'Metadaten in Datei einbetten',
    'match.processing': 'Bearbeite...',

    // Metadata
    'metadata.dialogTitle': 'Metadaten schreiben',
    'metadata.type': 'Typ',
    'metadata.show': 'Serienname',
    'metadata.titleField': 'Titel',
    'metadata.description': 'Beschreibung',
    'metadata.writeSuccess': 'Metadaten geschrieben',
    'metadata.writeError': 'Fehler beim Schreiben der Metadaten',
    'action.writeMetadata': 'Metadaten schreiben',
    'match.year': 'Jahr',

    // Notifications
    'notify.deleteSuccess': '{count} Datei(en) gelöscht',
    'notify.deleteError': 'Löschen einiger Dateien fehlgeschlagen',
    'notify.moveSuccess': '{count} Datei(en) verschoben',
    'notify.moveError': 'Verschieben einiger Dateien fehlgeschlagen',
    'notify.renameSuccess': 'Erfolgreich umbenannt',
    'notify.renameError': 'Umbenennen fehlgeschlagen',
    'notify.matchSuccess': 'Datei erfolgreich zugeordnet',
    'notify.matchError': 'Zuordnen fehlgeschlagen',
    'notify.seasonDeleteSuccess': 'Staffel gelöscht',
    'notify.backendError': 'Fehler: {message}',
    'notify.noTmdbApiKey':
      'TMDB API-Schlüssel nicht konfiguriert. Gehen Sie zu Einstellungen um Ihren Schlüssel hinzuzufügen. Kostenlos erhältlich auf themoviedb.org',

    // Error Log
    'errorLog.title': 'Fehlerprotokoll',
    'errorLog.noErrors': 'Keine Fehler aufgezeichnet',
    'errorLog.clear': 'Alle löschen',
    'action.close': 'Schließen',

    // Queue
    'queue.title': 'Zuordnungswarteschlange',
    'queue.addToQueue': 'Zur Warteschlange hinzufügen',
    'queue.processQueue': 'Warteschlange verarbeiten',
    'queue.clearQueue': 'Alle löschen',
    'queue.clearFinished': 'Abgeschloss. löschen',
    'queue.rescanAfter': 'Bibliothek nach Abschluss erneut scannen',
    'queue.processing': 'Verarbeitung...',
    'queue.empty': 'Warteschlange ist leer',
    'queue.itemAdded': 'Zur Warteschlange hinzugefügt',
    'queue.completed': 'Warteschlange abgeschlossen',

    // Editor
    'action.edit': 'Bearbeiten',
    'editor.title': 'FFmpeg-Editor',
    'editor.backToLibrary': 'Zurück zur Bibliothek',
    'editor.loading': 'Lade Datei...',
    'editor.fileNotFound': 'Datei nicht gefunden',
    'editor.containerConversion': 'Container-Konvertierung',
    'editor.containerDesc': 'In ein anderes Containerformat konvertieren ohne Neukodierung.',
    'editor.videoTranscoding': 'Video-Transkodierung',
    'editor.videoDesc': 'Video mit anderem Codec und Qualitätseinstellungen neukodieren.',
    'editor.audioTranscoding': 'Audio-Transkodierung',
    'editor.audioDesc': 'Audio mit anderem Codec und Bitrate neukodieren.',
    'editor.subtitles': 'Untertitel',
    'editor.subtitlesDesc': 'Untertitelspuren extrahieren, hinzufügen oder entfernen.',
    'editor.customCommand': 'Benutzerdefinierter Befehl',
    'editor.customDesc': 'Einen benutzerdefinierten FFmpeg-Befehl ausführen. Ohne "ffmpeg" Präfix.',
    'editor.convert': 'Konvertieren',
    'editor.transcode': 'Transkodieren',
    'editor.codec': 'Codec',
    'editor.quality': 'Qualität',
    'editor.preset': 'Preset',
    'editor.bitrate': 'Bitrate',
    'editor.extract': 'Extrahieren',
    'editor.remove': 'Entfernen',
    'editor.addSubtitle': 'Untertiteldatei hinzufügen',
    'editor.noSubtitles': 'Keine Untertitelspuren in dieser Datei.',
    'editor.history': 'Letzte Befehle',
    'editor.selectPrevious': 'Vorherigen Befehl wählen...',
    'editor.command': 'FFmpeg-Argumente',
    'editor.execute': 'Ausführen',
    'editor.processing': 'Verarbeitung...',
    'editor.success': 'Abgeschlossen',
    'editor.error': 'Fehler',
  },
} as const;

// Available languages
export const AVAILABLE_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'sv', name: 'Svenska' },
  { code: 'de', name: 'Deutsch' },
] as const;

type LanguageCode = keyof typeof TRANSLATIONS;

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly settingsService = inject(SettingsService);

  // Current translations based on language setting
  readonly $translations = computed(() => {
    const langCode = this.settingsService.$language() as LanguageCode;
    return TRANSLATIONS[langCode] ?? TRANSLATIONS['en'];
  });

  // Helper to get a specific translation
  translate(key: TranslationKey): string {
    return this.$translations()[key];
  }

  // Computed signal for a specific key - useful for templates
  t(key: TranslationKey) {
    return computed(() => this.$translations()[key]);
  }
}
