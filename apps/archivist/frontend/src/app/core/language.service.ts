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
    'app.backToStart': 'Back to Start',

    // Start Screen
    'start.title': 'Select folder',
    'start.matchWithAi': 'Match with AI',
    'start.matchWithAiDesc':
      'Automatically analyze and fix your media library using (local) AI.',
    'start.matchManually': 'Match manually',
    'start.matchManuallyDesc': 'Browse your library and apply fixes yourself.',
    'start.selectFolder': 'Select Folder',
    'start.noFolderSelected': 'No folder selected',
    'start.storageCleaner': 'Storage Cleaner',
    'start.storageCleanerDesc':
      'Find and remove empty folders and small unnecessary files.',
    'start.aiKeysRequired':
      'Provide TMDB API key in Settings to enable AI features.',

    // Scan controls
    'scan.folder': 'Scan Folder',
    'scan.again': 'Scan Again',
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
    'settings.organizeSeries': 'Organize series into folders',
    'settings.organizeSeriesDesc':
      'Automatically move TV episodes into "Show (Year)/Season N" folder structure.',
    'settings.hideCleanedSeasons': 'Hide Cleaned Seasons',
    'settings.close': 'Close',
    'settings.integrations': 'Integrations',
    'settings.ratingProvider': 'Data Provider',
    'settings.ratingProviderDesc': 'Choose where to fetch movie ratings from.',
    'settings.omdbApiKey': 'OMDB API Key (Optional for ratings)',
    'settings.tmdbApiKey': 'TMDB API Key (Mandatory for sorting)',
    'settings.getKeyFrom': 'Get your key from',
    'settings.enterApiKey': 'Enter API Key',
    'settings.validateAll': 'Validate All',
    'settings.validateAllSuccess': 'All keys are valid!',
    'settings.validateAllError': 'Some keys failed validation.',
    'settings.apiKeyRequired': 'API Key Setup Required',
    'settings.apiKeyRequiredDesc':
      'To use AI matching and metadata features, please provide your TMDB API key. OMDB is optional for ratings. Manual mode remains accessible without them.',
    'settings.continueManual': 'Continue to Manual Mode',
    'settings.validating': 'Validating...',
    'settings.saveAndValidate': 'Save & Validate',
    'settings.vlcPath': 'VLC Path',
    'settings.vlcPathDesc': 'Custom path to VLC media player (optional)',
    'settings.maintenance': 'Maintenance',
    'settings.fullReset': 'Reset Media Library',
    'settings.fullResetDesc':
      'Clears all library records, durations, codecs, and AI analysis results. A complete clean start.',
    'settings.resetAICache': 'Clear AI Analysis results',
    'settings.resetAICacheDesc':
      'Clears suggested names and clean status to allow re-running AI mode without a full re-scan.',
    'settings.reset': 'Reset',

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
    'confirm.fullReset':
      'Are you sure you want to perform a full reset? This will clear all scanned media and AI results.',
    'confirm.resetAICache':
      'Are you sure you want to clear AI results? Your basic library data will be preserved.',

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
    'match.viewOnTmdb': 'View on TMDB',
    'match.hideMatches': 'Hide Matches',
    'match.showMatches': 'Show Matches',
    'match.results': 'Match Results',
    'match.select': 'Select',
    'match.showMatchesWithCount': 'Show Matches ({count})',

    // Analysis
    'analysis.title': 'Library Optimization',
    'analysis.searchPlaceholder': 'Search movies, series...',
    'analysis.needsAttention': 'Needs Attention',
    'analysis.cleanCount': 'Clean',
    'analysis.reason': 'Reason',
    'analysis.original': 'Original',
    'analysis.suggested': 'Suggested',
    'analysis.targetFolder': 'Target Folder',
    'analysis.clean': 'Clean',
    'analysis.needsFix': 'Needs Fix',
    'analysis.filterBy': 'Show:',
    'analysis.filterBoth': 'All Media',
    'analysis.filterMovies': 'Movies',
    'analysis.filterTv': 'TV Series',
    'analysis.quickScan': 'Quick Scan (Cached)',
    'analysis.quickScanDesc':
      'Uses database results and only scans for new files.',
    'analysis.deepScan': 'Deep Scan (Full)',
    'analysis.deepScanDesc': 'Scan all media files without using cache.',
    'analysis.scanAsTv': 'Scan as TV Show',
    'analysis.scanAsMovie': 'Scan as Movie',
    'analysis.duplicateWarning': 'Duplicate name suggestion',
    'analysis.existsWarning': 'File already exists',
    'analysis.stop': 'Stop',
    'analysis.fixAllCount': 'Fix All ({count})',
    'analysis.analyzing': 'Analyzing...',
    'analysis.startAnalysis': 'Start Analysis',
    'analysis.emptyState':
      'No analysis results yet. Click "Start Analysis" to scan your library.',
    'analysis.emptyHint':
      'Accepted fixes will be added to the Match Queue for processing.',
    'analysis.movie': 'Movie',
    'analysis.tvSeries': 'TV Series',
    'analysis.aiEnhanced': 'AI Enhanced',
    'analysis.noFilesAttention': 'No files need attention.',
    'analysis.noCleanedFound': 'No cleaned files found yet.',
    'analysis.scanningChanges': 'Scanning library for changes...',
    'analysis.processingCount': 'Processing {current} / {total}',
    'analysis.noSeriesDetected': 'No TV series detected yet.',
    'analysis.runAnalysisHint':
      'Run analysis on a folder containing TV episodes to see them grouped here.',
    'analysis.missing': 'MISSING',
    'analysis.sample': 'SAMPLE',
    'analysis.notFound': 'Not Found',
    'analysis.applyFix': 'Apply Fix',
    'analysis.ignore': 'Ignore',
    'analysis.editMetadata': 'Edit Metadata',
    'analysis.openFolder': 'Open Containing Folder',
    'analysis.playInVlc': 'Play in VLC',
    'analysis.deleteFile': 'Delete File',
    'analysis.vlcNotFound':
      'VLC is not detected at the default location. Would you like to go to the download page?',
    'analysis.enclosingFolderEmpty':
      'The enclosing folder is now empty. Delete it as well?',
    'analysis.season': 'Season',
    'analysis.seasons': 'Seasons',
    'analysis.episode': 'Episode',
    'analysis.episodes': 'Episodes',
    'analysis.needFix': 'need fix',
    'analysis.needsFixPlural': 'needs fix',
    'analysis.missingBadge': 'missing',
    'analysis.allClean': 'All clean',
    'analysis.specials': 'Specials',

    // Cleaner
    'cleaner.title': 'Storage Cleaner',
    'cleaner.emptyFolders': 'Empty Folders',
    'cleaner.smallFiles': 'Small Files',
    'cleaner.sampleFiles': 'Sample Files',
    'cleaner.noResults': 'No items found for cleanup.',
    'cleaner.deleteSelected': 'Delete Selected ({count})',
    'cleaner.scanning': 'Scanning storage...',
    'cleaner.deleting': 'Deleting items...',
    'cleaner.startScan': 'Start Scan',

    // Settings Refinement
    'settings.aiConfig': 'AI Configuration',
    'settings.aiProvider': 'AI Provider',
    'settings.backgroundEngine': 'Background Processor',
    'settings.backgroundEngineDesc': 'Control the background task engine.',
    'settings.none': 'None',
    'settings.provider': 'Provider',
    'settings.providerDesc': 'Select the backend for AI operations',
    'settings.connectionStatus': 'Connection Status',
    'settings.connected': 'Connected',
    'settings.failed': 'Failed',
    'settings.loadingModels': 'Loading models...',
    'settings.ollamaUrl': 'Ollama URL',
    'settings.model': 'Model',
    'settings.apiKey': 'API Key',
    'settings.testConnection': 'Test Connection',
    'settings.testing': 'Testing...',
    'settings.providerNone': 'Disabled',
    'settings.providerOllama': 'Ollama (Local)',
    'settings.providerOpenai': 'OpenAI',
    'settings.providerClaude': 'Claude (Anthropic)',
    'settings.providerGemini': 'Gemini (Google)',
    'settings.invalidApiKey': 'Invalid API key',
    'settings.connectionFailed': 'Connection failed',
    'settings.recommendedModel': 'Recommended Model',
    'settings.recommendedModelDesc':
      'For best results, we recommend using a capable model like Qwen3-Coder (32B).',
    'settings.installModel': 'Install Recommended Model',
    'settings.installing': 'Installing...',
    'settings.installSuccess': 'Model is installed!',
    'settings.installError': 'Failed to install model. Please check Ollama.',

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
    'notify.fullResetSuccess': 'Library and AI results reset successfully',
    'notify.resetAICacheSuccess': 'Cleared AI results for {count} files',

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
    'queue.processAll': 'Process Queue',
    'queue.bgStatus': 'Background Status',
    'queue.running': 'Running',
    'queue.paused': 'Paused',
    'queue.pauseEngine': 'Pause Engine',
    'queue.resumeEngine': 'Resume Engine',
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
    'editor.containerDesc':
      'Convert to a different container format without re-encoding.',
    'editor.videoTranscoding': 'Video Transcoding',
    'editor.videoDesc':
      'Re-encode video with different codec and quality settings.',
    'editor.audioTranscoding': 'Audio Transcoding',
    'editor.audioDesc': 'Re-encode audio with different codec and bitrate.',
    'editor.subtitles': 'Subtitles',
    'editor.subtitlesDesc': 'Extract, add, or remove subtitle tracks.',
    'editor.customCommand': 'Custom Command',
    'editor.customDesc':
      'Run a custom FFmpeg command. Do not include "ffmpeg" prefix.',
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
    'app.backToStart': 'Tillbaka till start',

    // Start Screen
    'start.title': 'Välj mapp',
    'start.matchWithAi': 'Matcha med AI',
    'start.matchWithAiDesc':
      'Analysera och fixa ditt mediebibliotek automatiskt med (lokal) AI.',
    'start.matchManually': 'Matcha manuellt',
    'start.matchManuallyDesc':
      'Bläddra i ditt bibliotek och applicera fixar själv.',
    'start.selectFolder': 'Välj mapp',
    'start.noFolderSelected': 'Ingen mapp vald',
    'start.storageCleaner': 'Rensa Lagring',
    'start.storageCleanerDesc':
      'Hitta och ta bort tomma mappar och små onödiga filer.',
    'start.aiKeysRequired':
      'Ange TMDB API-nyckel i Inställningar för att aktivera AI-funktioner.',

    // Scan controls
    'scan.folder': 'Skanna Mapp',
    'scan.again': 'Skanna Igen',
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
    'settings.organizeSeries': 'Organisera serier i mappar',
    'settings.organizeSeriesDesc':
      'Flytta automatiskt TV-avsnitt till mappstrukturen "Serie (År)/Säsong N".',
    'settings.hideCleanedSeasons': 'Dölj rena säsonger',
    'settings.close': 'Stäng',
    'settings.integrations': 'Integrationer',
    'settings.aiProvider': 'AI-leverantör',
    'settings.backgroundEngine': 'Bakgrundsprocesser',
    'settings.backgroundEngineDesc': 'Styr bakgrundsmotorn för uppgifter.',
    'settings.none': 'Ingen',
    'settings.ratingProvider': 'Dataleverantör',
    'settings.ratingProviderDesc': 'Välj varifrån filmbetyg ska hämtas.',
    'settings.omdbApiKey': 'OMDB API-nyckel (Valfritt för betyg)',
    'settings.tmdbApiKey': 'TMDB API-nyckel (Krävs för sortering)',
    'settings.getKeyFrom': 'Skaffa din nyckel från',
    'settings.enterApiKey': 'Ange API-nyckel',
    'settings.validateAll': 'Validera alla',
    'settings.validateAllSuccess': 'Alla nycklar är giltiga!',
    'settings.validateAllError': 'Vissa nycklar misslyckades med valideringen.',
    'settings.apiKeyRequired': 'API-nycklar krävs',
    'settings.apiKeyRequiredDesc':
      'För att använda AI-matchning och metadatafunktioner, vänligen ange din TMDB API-nyckel. OMDB är valfritt för betyg. Manuellt läge förblir tillgängligt utan dem.',
    'settings.continueManual': 'Fortsätt till manuellt läge',
    'settings.validating': 'Validerar...',
    'settings.saveAndValidate': 'Spara och validera',
    'settings.vlcPath': 'VLC-sökväg',
    'settings.vlcPathDesc': 'Anpassad sökväg till VLC (valfritt)',
    'settings.maintenance': 'Underhåll',
    'settings.fullReset': 'Återställ mediebibliotek',
    'settings.fullResetDesc':
      'Rensar alla biblioteksposter, längder, codecs och AI-analysresultat. En komplett nystart.',
    'settings.resetAICache': 'Rensa AI-analysresultat',
    'settings.resetAICacheDesc':
      'Rensar föreslagna namn och ren status för att tillåta att AI-läge körs igen utan en fullständig omscanning.',
    'settings.reset': 'Återställ',

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
    'confirm.fullReset':
      'Är du säker på att du vill göra en fullständig återställning? Detta rensar all skannad media och AI-resultat.',
    'confirm.resetAICache':
      'Är du säker på att du vill rensa AI-resultaten? Din grundläggande biblioteksdata kommer att bevaras.',

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
    'match.viewOnTmdb': 'Visa på TMDB',
    'match.hideMatches': 'Dölj matchningar',
    'match.showMatches': 'Visa matchningar',
    'match.results': 'Matchningsresultat',
    'match.select': 'Välj',
    'match.showMatchesWithCount': 'Visa matchningar ({count})',

    // Analysis
    'analysis.title': 'Biblioteksoptimering',
    'analysis.searchPlaceholder': 'Sök filmer, serier...',
    'analysis.needsAttention': 'Behöver åtgärdas',
    'analysis.quickScan': 'Snabbskanning (Cachad)',
    'analysis.quickScanDesc':
      'Använder databasresultat och skannar endast efter nya filer.',
    'analysis.deepScan': 'Djupskanning (Fullständig)',
    'analysis.deepScanDesc': 'Skanna alla mediafiler utan att använda cache.',
    'analysis.scanAsTv': 'Skanna som TV-serie',
    'analysis.scanAsMovie': 'Skanna som film',
    'analysis.cleanCount': 'Rena',
    'analysis.reason': 'Anledning',
    'analysis.original': 'Ursprunglig',
    'analysis.suggested': 'Föreslagen',
    'analysis.targetFolder': 'Målmapp',
    'analysis.clean': 'Ren',
    'analysis.needsFix': 'Behöver fixas',
    'analysis.filterBy': 'Visa:',
    'analysis.filterBoth': 'All Media',
    'analysis.filterMovies': 'Filmer',
    'analysis.filterTv': 'TV-Serier',
    'analysis.duplicateWarning': 'Dubblettnamnsförslag',
    'analysis.existsWarning': 'Filen finns redan',
    'analysis.stop': 'Stoppa',
    'analysis.fixAllCount': 'Fixa alla ({count})',
    'analysis.analyzing': 'Analyserar...',
    'analysis.startAnalysis': 'Starta analys',
    'analysis.emptyState':
      'Inga analysresultat ännu. Klicka på "Starta analys" för att skanna ditt bibliotek.',
    'analysis.emptyHint':
      'Accepterade fixar kommer att läggas till i matchningskön för bearbetning.',
    'analysis.movie': 'Film',
    'analysis.tvSeries': 'TV-serie',
    'analysis.aiEnhanced': 'AI-förbättrad',
    'analysis.noFilesAttention': 'Inga filer behöver åtgärdas.',
    'analysis.noCleanedFound': 'Inga rena filer hittades ännu.',
    'analysis.scanningChanges': 'Skannar biblioteket efter ändringar...',
    'analysis.processingCount': 'Bearbetar {current} / {total}',
    'analysis.noSeriesDetected': 'Inga TV-serier upptäckta ännu.',
    'analysis.runAnalysisHint':
      'Kör analys på en mapp som innehåller TV-avsnitt för att se dem grupperade här.',
    'analysis.missing': 'SAKNAS',
    'analysis.sample': 'SAMPLE',
    'analysis.notFound': 'Hittades inte',
    'analysis.applyFix': 'Applicera fix',
    'analysis.ignore': 'Ignorera',
    'analysis.editMetadata': 'Redigera metadata',
    'analysis.openFolder': 'Öppna omslutande mapp',
    'analysis.playInVlc': 'Spela i VLC',
    'analysis.deleteFile': 'Radera fil',
    'analysis.vlcNotFound':
      'VLC hittades inte på standardplatsen. Vill du gå till nedladdningssidan?',
    'analysis.enclosingFolderEmpty':
      'Den omslutande mappen är nu tom. Vill du radera den också?',
    'analysis.season': 'Säsong',
    'analysis.seasons': 'Säsonger',
    'analysis.episode': 'Avsnitt',
    'analysis.episodes': 'Avsnitt',
    'analysis.needFix': 'behöver fixas',
    'analysis.needsFixPlural': 'behöver fixas',
    'analysis.missingBadge': 'saknas',
    'analysis.allClean': 'Allt rent',
    'analysis.specials': 'Specialavsnitt',

    // Cleaner
    'cleaner.title': 'Rensa Lagring',
    'cleaner.emptyFolders': 'Tomma mappar',
    'cleaner.smallFiles': 'Små filer',
    'cleaner.sampleFiles': 'Exempelfiler',
    'cleaner.noResults': 'Inga objekt hittades att rensa.',
    'cleaner.deleteSelected': 'Radera markerade ({count})',
    'cleaner.scanning': 'Skannar lagring...',
    'cleaner.deleting': 'Raderar objekt...',
    'cleaner.startScan': 'Starta skanning',

    // Settings Refinement
    'settings.aiConfig': 'AI-konfiguration',
    'settings.provider': 'Leverantör',
    'settings.providerDesc': 'Välj backend för AI-operationer',
    'settings.connectionStatus': 'Anslutningsstatus',
    'settings.connected': 'Ansluten',
    'settings.failed': 'Misslyckades',
    'settings.loadingModels': 'Laddar modeller...',
    'settings.ollamaUrl': 'Ollama URL',
    'settings.model': 'Modell',
    'settings.apiKey': 'API-nyckel',
    'settings.testConnection': 'Testa anslutning',
    'settings.testing': 'Testar...',
    'settings.providerNone': 'Inaktiverad',
    'settings.providerOllama': 'Ollama (Lokal)',
    'settings.providerOpenai': 'OpenAI',
    'settings.providerClaude': 'Claude (Anthropic)',
    'settings.providerGemini': 'Gemini (Google)',
    'settings.invalidApiKey': 'Ogiltig API-nyckel',
    'settings.connectionFailed': 'Anslutningen misslyckades',
    'settings.recommendedModel': 'Rekommenderad modell',
    'settings.recommendedModelDesc':
      'För bästa resultat rekommenderar vi en kapabel modell som Qwen3-Coder (32B).',
    'settings.installModel': 'Installera rekommenderad modell',
    'settings.installing': 'Installerar...',
    'settings.installSuccess': 'Modellen är installerad!',
    'settings.installError':
      'Kunde inte installera modellen. Kontrollera Ollama.',

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
    'notify.fullResetSuccess': 'Bibliotek och AI-resultat har återställts',
    'notify.resetAICacheSuccess': 'Rensade AI-resultat för {count} filer',

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
    'queue.processAll': 'Processera kö',
    'queue.bgStatus': 'Bakgrundsstatus',
    'queue.running': 'Körs',
    'queue.paused': 'Pausad',
    'queue.pauseEngine': 'Pausa motor',
    'queue.resumeEngine': 'Återuppta motor',
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
    'editor.containerDesc':
      'Konvertera till ett annat containerformat utan omkodning.',
    'editor.videoTranscoding': 'Videotranskodning',
    'editor.videoDesc': 'Koda om video med annan codec och kvalitet.',
    'editor.audioTranscoding': 'Ljudtranskodning',
    'editor.audioDesc': 'Koda om ljud med annan codec och bitrate.',
    'editor.subtitles': 'Undertexter',
    'editor.subtitlesDesc': 'Extrahera, lägg till eller ta bort undertextspår.',
    'editor.customCommand': 'Anpassat kommando',
    'editor.customDesc':
      'Kör ett anpassat FFmpeg-kommando. Inkludera inte "ffmpeg" prefix.',
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
    'app.backToStart': 'Zurück zum Start',

    // Start Screen
    'start.title': 'Verzeichnis wählen',
    'start.matchWithAi': 'Mit AI abgleichen',
    'start.matchWithAiDesc':
      'Analysiere und korrigiere deine Mediathek automatisch mit (lokaler) AI.',
    'start.matchManually': 'Manuell abgleichen',
    'start.matchManuallyDesc':
      'Durchsuche deine Mediathek und wende Korrekturer själv an.',
    'start.selectFolder': 'Ordner wählen',
    'start.noFolderSelected': 'Kein Ordner ausgewählt',
    'start.storageCleaner': 'Speicher Reinigen',
    'start.storageCleanerDesc':
      'Finden und entfernen Sie leere Ordner und kleine unnötige Dateien.',
    'start.aiKeysRequired':
      'Geben Sie den TMDB API-Schlüssel in den Einstellungen an, um AI-Funktionen zu aktivieren.',

    // Scan controls
    'scan.folder': 'Ordner scannen',
    'scan.again': 'Erneut scannen',
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
    'settings.organizeSeries': 'Serien in Ordnern organisieren',
    'settings.organizeSeriesDesc':
      'TV-Folgen automatisch in die Ordnerstruktur "Serie (Jahr)/Staffel N" verschieben.',
    'settings.hideCleanedSeasons': 'Bereinigte Staffeln ausblenden',
    'settings.close': 'Schließen',
    'settings.integrations': 'Integrationen',
    'settings.aiProvider': 'AI-Anbieter',
    'settings.backgroundEngine': 'Hintergrundprozessor',
    'settings.backgroundEngineDesc':
      'Steuern Sie die Hintergrund-Engine für Aufgaben.',
    'settings.none': 'Keine',
    'settings.ratingProvider': 'Datemquelle',
    'settings.ratingProviderDesc':
      'Wählen Sie, woher Filmbewertungen abgerufen werden.',
    'settings.omdbApiKey': 'OMDB API-Schlüssel (Optional für Bewertungen)',
    'settings.tmdbApiKey': 'TMDB API-Schlüssel (Erforderlich für Sortierung)',
    'settings.getKeyFrom': 'Erhalten Sie Ihren Schlüssel von',
    'settings.enterApiKey': 'API-Schlüssel eingeben',
    'settings.validateAll': 'Alle validieren',
    'settings.validateAllSuccess': 'Alle Schlüssel sind gültig!',
    'settings.validateAllError':
      'Einige Schlüssel konnten nicht validiert werden.',
    'settings.apiKeyRequired': 'API-Schlüssel erforderlich',
    'settings.apiKeyRequiredDesc':
      'Um AI-Abgleich und Metadaten-Funktionen zu nutzen, geben Sie bitte Ihren TMDB API-Schlüssel an. OMDB ist optional für Bewertungen. Der manuelle Modus bleibt auch ohne diese zugänglich.',
    'settings.continueManual': 'Weiter zum manuellen Modus',
    'settings.validating': 'Validierung...',
    'settings.saveAndValidate': 'Speichern & Validieren',
    'settings.vlcPath': 'VLC-Pfad',
    'settings.vlcPathDesc':
      'Benutzerdefinierter Pfad zum VLC Media Player (optional)',
    'analysis.filterBy': 'Zeige:',
    'analysis.filterBoth': 'Alle Medien',
    'analysis.filterMovies': 'Filme',
    'analysis.filterTv': 'Serien',
    'settings.maintenance': 'Wartung',
    'settings.fullReset': 'Medienbibliothek zurücksetzen',
    'settings.fullResetDesc':
      'Löscht alle Bibliothekseinträge, Dauern, Codecs und KI-Analyseergebnisse. Ein kompletter Neustart.',
    'settings.resetAICache': 'KI-Analyseergebnisse löschen',
    'settings.resetAICacheDesc':
      'Löscht vorgeschlagene Namen und den Clean-Status, um den KI-Modus ohne erneuten vollständigen Scan auszuführen.',
    'settings.reset': 'Zurücksetzen',

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
    'confirm.fullReset':
      'Sind Sie sicher, dass Sie alles zurücksetzen möchten? Dies löscht alle gescannten Medien und KI-Ergebnisse.',
    'confirm.resetAICache':
      'Sind Sie sicher, dass Sie die KI-Ergebnisse löschen möchten? Ihre Basis-Bibliotheksdaten bleiben erhalten.',

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
    'match.viewOnTmdb': 'Auf TMDB ansehen',
    'match.hideMatches': 'Matches ausblenden',
    'match.showMatches': 'Matches anzeigen',
    'match.results': 'Match-Ergebnisse',
    'match.select': 'Auswählen',
    'match.showMatchesWithCount': 'Matches anzeigen ({count})',

    // Analysis
    'analysis.title': 'Bibliotheksoptimierung',
    'analysis.searchPlaceholder': 'Suche Filme, Serien...',
    'analysis.needsAttention': 'Aufmerksamkeit erforderlich',
    'analysis.cleanCount': 'Sauber',
    'analysis.reason': 'Grund',
    'analysis.original': 'Original',
    'analysis.suggested': 'Vorgeschlagen',
    'analysis.targetFolder': 'Zielordner',
    'analysis.clean': 'Sauber',
    'analysis.needsFix': 'Korrektur nötig',
    'analysis.quickScan': 'Schnell-Scan (Gecached)',
    'analysis.quickScanDesc':
      'Nutzt Datenbankergebnisse und sucht nur nach neuen Dateien.',
    'analysis.deepScan': 'Tiefen-Scan (Vollständig)',
    'analysis.deepScanDesc':
      'Komplette Dateisystem-Suche (langsamer aber gründlich).',
    'analysis.scanAsTv': 'Als TV-Serie scannen',
    'analysis.scanAsMovie': 'Als Film scannen',
    'analysis.duplicateWarning': 'Namensvorschlag bereits vorhanden',
    'analysis.existsWarning': 'Datei existiert bereits',
    'analysis.stop': 'Stopp',
    'analysis.fixAllCount': 'Alle korrigieren ({count})',
    'analysis.analyzing': 'Analysiere...',
    'analysis.startAnalysis': 'Analyse starten',
    'analysis.emptyState':
      'Noch keine Analyseergebnisse. Klicken Sie auf "Analyse starten", um Ihre Bibliothek zu scanen.',
    'analysis.emptyHint':
      'Akzeptierte Korrekturen werden zur Bearbeitung in die Match-Warteschlange aufgenommen.',
    'analysis.movie': 'Film',
    'analysis.tvSeries': 'TV-Serie',
    'analysis.aiEnhanced': 'KI-optimiert',
    'analysis.noFilesAttention': 'Keine Dateien erfordern Aufmerksamkeit.',
    'analysis.noCleanedFound': 'Noch keine sauberen Dateien gefunden.',
    'analysis.scanningChanges': 'Bibliothek wird auf Änderungen gescannt...',
    'analysis.processingCount': 'Verarbeitung {current} / {total}',
    'analysis.noSeriesDetected': 'Noch keine TV-Serien erkannt.',
    'analysis.runAnalysisHint':
      'Führen Sie eine Analyse für einen Ordner mit TV-Folgen aus, um diese hier gruppiert zu sehen.',
    'analysis.missing': 'FEHLT',
    'analysis.sample': 'SAMPLE',
    'analysis.notFound': 'Nicht gefunden',
    'analysis.applyFix': 'Fix anwenden',
    'analysis.ignore': 'Ignorieren',
    'analysis.editMetadata': 'Metadaten bearbeiten',
    'analysis.openFolder': 'Übergeordneten Ordner öffnen',
    'analysis.playInVlc': 'In VLC abspielen',
    'analysis.deleteFile': 'Datei löschen',
    'analysis.vlcNotFound':
      'VLC wurde am Standardort nicht gefunden. Möchten Sie zur Download-Seite gehen?',
    'analysis.enclosingFolderEmpty':
      'Der übergeordnete Ordner ist jetzt leer. Auch löschen?',
    'analysis.season': 'Staffel',
    'analysis.seasons': 'Staffeln',
    'analysis.episode': 'Folge',
    'analysis.episodes': 'Folgen',
    'analysis.needFix': 'Korrektur nötig',
    'analysis.needsFixPlural': 'Korrekturen nötig',
    'analysis.missingBadge': 'fehlend',
    'analysis.allClean': 'Alles sauber',
    'analysis.specials': 'Specials',

    // Cleaner
    'cleaner.title': 'Speicher Reinigen',
    'cleaner.emptyFolders': 'Leere Ordner',
    'cleaner.smallFiles': 'Kleine Dateien',
    'cleaner.sampleFiles': 'Beispieldateien',
    'cleaner.noResults': 'Keine Objekte zum Bereinigen gefunden.',
    'cleaner.deleteSelected': 'Markierte löschen ({count})',
    'cleaner.scanning': 'Speicher wird gescannt...',
    'cleaner.deleting': 'Objekte werden gelöscht...',
    'cleaner.startScan': 'Scan starten',

    // Settings Refinement
    'settings.aiConfig': 'AI-Konfiguration',
    'settings.provider': 'Anbieter',
    'settings.providerDesc': 'Wählen Sie das Backend für AI-Operationen',
    'settings.connectionStatus': 'Verbindungsstatus',
    'settings.connected': 'Verbunden',
    'settings.failed': 'Fehlgeschlagen',
    'settings.loadingModels': 'Modelle werden geladen...',
    'settings.ollamaUrl': 'Ollama URL',
    'settings.model': 'Modell',
    'settings.apiKey': 'API-Schlüssel',
    'settings.testConnection': 'Verbindung testen',
    'settings.testing': 'Teste...',
    'settings.providerNone': 'Deaktiviert',
    'settings.providerOllama': 'Ollama (Lokal)',
    'settings.providerOpenai': 'OpenAI',
    'settings.providerClaude': 'Claude (Anthropic)',
    'settings.providerGemini': 'Gemini (Google)',
    'settings.invalidApiKey': 'Ungültiger API-Schlüssel',
    'settings.connectionFailed': 'Verbindung fehlgeschlagen',
    'settings.recommendedModel': 'Empfohlenes Modell',
    'settings.recommendedModelDesc':
      'Für beste Ergebnisse empfehlen wir ein leistungsfähiges Modell wie Qwen3-Coder (32B).',
    'settings.installModel': 'Empfohlenes Modell installieren',
    'settings.installing': 'Installiere...',
    'settings.installSuccess': 'Modell ist installiert!',
    'settings.installError':
      'Installation fehlgeschlagen. Bitte Ollama überprüfen.',

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
    'notify.fullResetSuccess':
      'Bibliothek und KI-Ergebnisse erfolgreich zurückgesetzt',
    'notify.resetAICacheSuccess': 'KI-Ergebnisse für {count} Dateien gelöscht',

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
    'queue.clearFinished': 'Abgeschlossene löschen',
    'queue.processAll': 'Warteschlange verarbeiten',
    'queue.bgStatus': 'Hintergrundstatus',
    'queue.running': 'Läuft',
    'queue.paused': 'Pausiert',
    'queue.pauseEngine': 'Engine pausieren',
    'queue.resumeEngine': 'Engine fortsetzen',
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
    'editor.containerDesc':
      'In ein anderes Containerformat konvertieren ohne Neukodierung.',
    'editor.videoTranscoding': 'Video-Transkodierung',
    'editor.videoDesc':
      'Video mit anderem Codec und Qualitätseinstellungen neukodieren.',
    'editor.audioTranscoding': 'Audio-Transkodierung',
    'editor.audioDesc': 'Audio mit anderem Codec und Bitrate neukodieren.',
    'editor.subtitles': 'Untertitel',
    'editor.subtitlesDesc':
      'Untertitelspuren extrahieren, hinzufügen oder entfernen.',
    'editor.customCommand': 'Benutzerdefinierter Befehl',
    'editor.customDesc':
      'Einen benutzerdefinierten FFmpeg-Befehl ausführen. Ohne "ffmpeg" Präfix.',
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
  translate(
    key: TranslationKey,
    params?: Record<string, string | number>,
  ): string {
    let translation = this.$translations()[key] as string;

    if (params) {
      Object.keys(params).forEach((paramKey) => {
        const value = params[paramKey];
        translation = translation.replace(`{${paramKey}}`, value.toString());
      });
    }

    return translation;
  }

  // Computed signal for a specific key - useful for templates
  t(key: TranslationKey) {
    return computed(() => this.$translations()[key]);
  }
}
