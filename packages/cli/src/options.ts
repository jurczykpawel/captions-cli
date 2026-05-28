export interface CliOptions {
  videoPath: string;
  outputPath: string;
  engine: string;
  preset: string;
  language: string;
  highlightColor: string;
  upcomingColor?: string;
  position: number;
  fontSize: number;
  fontColor: string;
  whisperProvider: 'whisper-cpp' | 'openai';
  whisperModel?: string;
}
