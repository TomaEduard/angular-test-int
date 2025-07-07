import {AfterViewInit, Component, effect, ElementRef, input, OnInit, signal, viewChild} from '@angular/core';
import {JsonPipe} from "@angular/common";

export enum MessageType {
  SEND = 'send',
  RECEIVED = 'received'
}

@Component({
  selector: 'app-voice-message-player',
  imports: [
    JsonPipe
  ],
  templateUrl: './voice-message-player.html',
  styleUrl: './voice-message-player.scss'
})
export class VoiceMessagePlayer implements OnInit, AfterViewInit {
  audioSrc = input("");
  messageType = input<MessageType>(MessageType.RECEIVED);

  audioEl = viewChild<ElementRef<HTMLAudioElement>>('audioEl');
  waveformWrapperEl = viewChild<ElementRef<HTMLDivElement>>('waveformWrapperEl');

  isLoaded = signal(false);
  isPlaying = signal(false);
  waveformData = signal<number[]>([]);
  duration = signal(0);
  isAnalyzing = signal(false);
  isDragging = signal(false);
  progressPercentage = signal(0);
  playedBarsCount = signal(0);
  currentTime = signal(0);
  playbackRate = signal(1);

  // A-B segment state
  segmentPointA = signal<number | null>(null);
  segmentPointB = signal<number | null>(null);
  isPointAActive = signal<boolean>(false);
  isPointBActive = signal<boolean>(false);

  private audioContext: AudioContext | null = null;
  private waveformBars: number = 107;
  private playbackRates = [1, 1.25, 1.5, 2];
  private currentRateIndex = 0;
  private previousAudioSrc: string = '';

  constructor() {
    // Create an effect to detect changes in audioSrc
    effect(() => {
      const currentAudioSrc = this.audioSrc();

      // Only reset if the audioSrc has changed and it's not the initial setup
      if (this.previousAudioSrc && this.previousAudioSrc !== currentAudioSrc) {
        console.log(`🔵 audioSrc changed from ${this.previousAudioSrc} to ${currentAudioSrc}`);
        this.resetPlayer();
      }

      this.previousAudioSrc = currentAudioSrc;
    });
  }

  ngOnInit(): void {
    console.log(`🔵 ngOnInit audioSrc`, this.audioSrc());
    this.generatePlaceholderWaveForm();
  }

  /**
   * Resets the player when the audio source changes
   */
  private resetPlayer(): void {
    console.log(`🔵 resetPlayer called`);

    const audio = this.audioEl()?.nativeElement;
    if (audio) {
      // Stop playback if playing
      if (this.isPlaying()) {
        audio.pause();
      }

      // Reset player state
      this.isPlaying.set(false);
      this.progressPercentage.set(0);
      this.playedBarsCount.set(0);
      this.currentTime.set(0);
      this.isLoaded.set(false);

      // Reset segment points
      this.segmentPointA.set(null);
      this.segmentPointB.set(null);
      this.isPointAActive.set(false);
      this.isPointBActive.set(false);

      // Reset playback rate to default
      this.currentRateIndex = 0;
      this.playbackRate.set(this.playbackRates[this.currentRateIndex]);
      audio.playbackRate = this.playbackRate();

      // Load the new source
      audio.load();
    }

    // Generate placeholder waveform until the new audio is analyzed
    this.generatePlaceholderWaveForm();
  }


  private generatePlaceholderWaveForm(): void {
    const placeholderWaveForm = Array.from({length: this.waveformBars}, () => {
      return Math.random() * 12 + 8;
    });
    this.waveformData.set(placeholderWaveForm);

    console.log('🔵 generatePlaceholderWaveForm', {
      waveformDataLength: this.waveformData().length,
      waveformBars: this.waveformBars
    });
  }

  public getAudioSrc(): string  {
    const src = this.audioSrc();
    return src || '';
  }

  ngAfterViewInit(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioElement = this.audioEl()?.nativeElement;
      console.log(`🔵 ngAfterViewInit audioElement`, audioElement);

      if (audioElement) {
        audioElement.load();
        this.isLoaded.set(true);
      }
    } catch (e) {
      console.log(`🔴 the audio is not recognized`, e);
    }
  }

  protected onloadedMetadata(): void {
    const audioElement = this.audioEl()?.nativeElement;

    if (audioElement) {
      this.duration.set(audioElement.duration || 0);
      this.isLoaded.set(true);
    } else {
      this.duration.set(0);
    }
  }


  protected togglePlayPause(): void {
    const audio = this.audioEl()?.nativeElement;
    console.log(`🔵 togglePlayPause this.audioEl()?.nativeElement`, audio);
    if (this.isPlaying()) {
      audio?.pause();
    } else {
      audio?.play().then(r => console.log(`🟢 play`,));
    }

    this.isPlaying.set(!this.isPlaying());
  }

  protected async analyzedAudio(): Promise<void> {
    if (!this.audioContext || !this.audioSrc()) {
      this.generatePlaceholderWaveForm();
      return;
    }

    this.isAnalyzing.set(true);

    try {
      const response = await fetch(this.audioSrc());
      if (!response.ok) {
        console.log(`🔴 analyzedAudio Response status ${response.status}`);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffe = await this.audioContext.decodeAudioData(arrayBuffer);
      const channelData = audioBuffe.getChannelData(0);
      const sampleRate = audioBuffe.sampleRate;
      const duration = audioBuffe.duration;

      const samplesPerBar = Math.floor(channelData.length / this.waveformBars);

      this.waveformData.set([]);

      for (let i = 0; i < this.waveformBars; i++) {
        const start = i * samplesPerBar;
        const end = Math.min(start + samplesPerBar, channelData.length);

        let sum = 0;
        let maxAmplitude = 0;

        for (let j = start; j < end; j++) {
          const amplitude = Math.abs(channelData[j]);
          sum += amplitude * amplitude;
          maxAmplitude = Math.max(maxAmplitude, amplitude);
        }

        const rms = Math.sqrt(sum / (end - start));
        const normalizeHeight = rms * 1.5;
        const height = Math.max(6, Math.min(28, normalizeHeight * 100));

        this.waveformData.update(data => [...data, Math.round(height)]);
      }

    } catch (e) {
      console.error(`🔴 error at analyzed data:`, e);
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  onTimeUpdate(): void {
    if (!this.isDragging()) {
      const audio = this.audioEl()?.nativeElement;
      if (audio) {
        this.currentTime.set(audio.currentTime);
        this.updateProgress();

        console.log('🔵 onTimeUpdate', {
          currentTime: this.currentTime(),
          duration: this.duration(),
          progressPercentage: this.progressPercentage(),
          playedBarsCount: this.playedBarsCount()
        });
      }
    }
  }

  private updateProgress(): void {

    if (this.duration() > 0) {
      this.progressPercentage.set((this.currentTime() / this.duration()) * 100);
      this.updatePlayerBards();

    }
  }

  private updatePlayerBards(): void {
    this.playedBarsCount.set(Math.floor((this.progressPercentage() / 100) * this.waveformBars));
  }

  onEnded(): void {
    this.isPlaying.set(false);
    this.progressPercentage.set(0);
    this.playedBarsCount.set(0);
    this.currentTime.set(0);

    // Reset segment points
    this.segmentPointA.set(null);
    this.segmentPointB.set(null);
    this.isPointAActive.set(false);
    this.isPointBActive.set(false);
  }


  formatTime(time: number): string {
    if (isNaN(time) || time < 0) return '0:00';

    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }


  getSegmentPointPercentage(time: number | null): number {
    if (time === null || this.duration() <= 0) return 0;
    return (time / this.duration()) * 100;
  }


  isSegmentButtonDisabled(): boolean {
    // If point A is active and we're trying to set point B
    if (this.isPointAActive() && !this.isPointBActive()) {
      // Disable the button if the current time is less than or equal to point A's time
      const pointATime = this.segmentPointA();
      const currentTimeValue = this.currentTime();
      return pointATime !== null && currentTimeValue <= pointATime;
    }
    return false;
  }

  onSegment(): void {
    console.log('A-B segment button clicked');
    const currentTimeValue = this.currentTime();

    // If both points are active, reset everything
    if (this.isPointAActive() && this.isPointBActive()) {
      this.segmentPointA.set(null);
      this.segmentPointB.set(null);
      this.isPointAActive.set(false);
      this.isPointBActive.set(false);
      console.log('Reset segment points');
    } else if (this.isPointAActive() && !this.isPointBActive()) {
      this.segmentPointB.set(currentTimeValue);
      this.isPointBActive.set(true);
      console.log('Set segment point B:', this.formatTime(currentTimeValue));
    } else {
      this.segmentPointA.set(currentTimeValue);
      this.isPointAActive.set(true);
      this.segmentPointB.set(null);
      this.isPointBActive.set(false);
      console.log('Set segment point A:', this.formatTime(currentTimeValue));
    }
  }

  toggleSpeed(): void {
    this.currentRateIndex = (this.currentRateIndex + 1) % this.playbackRates.length;
    this.playbackRate.set(this.playbackRates[this.currentRateIndex]);
    const audio = this.audioEl()?.nativeElement;
    if (audio) {
      audio.playbackRate = this.playbackRate();
    }
  }

  onWaveformClick(event: MouseEvent): void {
    if (!this.isLoaded() || this.isAnalyzing()) return;

    const rect = this.waveformWrapperEl()?.nativeElement.getBoundingClientRect();
    if (rect) {
      const clickX = event.clientX - rect.left;
      const progressPercentage = (clickX / rect.width) * 100;
      this.setProgress(progressPercentage);
    }
  }

  private setProgress(proc: number): void {
    const audio = this.audioEl()?.nativeElement;
    if (audio) {
      const newTime = (proc / 100) * this.duration();
      audio.currentTime = newTime;

      this.currentTime.set(newTime);
      this.progressPercentage.set(proc);
      this.updatePlayerBards();
    }
  }

  private isDraggingThumb = false;
  private initialClickOffset = 0;

  startDragging(event: MouseEvent): void {
    if (!this.isLoaded() || this.isAnalyzing()) return;

    event.preventDefault();

    this.isDragging.set(true);

    const target = event.target as HTMLElement;
    this.isDraggingThumb = target.classList.contains('progress-thumb');

    const rect = this.waveformWrapperEl()?.nativeElement.getBoundingClientRect();
    if (rect) {
      if (this.isDraggingThumb) {
        const thumbPosition = (this.progressPercentage() / 100) * rect.width;
        this.initialClickOffset = event.clientX - (rect.left + thumbPosition);

        console.log('🔵 startDragging on thumb', {
          clientX: event.clientX,
          rectLeft: rect.left,
          thumbPosition,
          initialClickOffset: this.initialClickOffset
        });
      } else {
        this.initialClickOffset = 0;

        const clickX = event.clientX - rect.left;
        const progressPercentage = (clickX / rect.width) * 100;
        this.progressPercentage.set(progressPercentage);
        this.updatePlayerBards();
      }
    }

    document.addEventListener('mousemove', this.handleDocumentMouseMove);
    document.addEventListener('mouseup', this.handleDocumentMouseUp);
  }

  private handleDocumentMouseMove = (event: MouseEvent): void => {
    this.onDrag(event);
  }

  private handleDocumentMouseUp = (event: MouseEvent): void => {
    document.removeEventListener('mousemove', this.handleDocumentMouseMove);
    document.removeEventListener('mouseup', this.handleDocumentMouseUp);
    this.stopDragging();
  }

  onDrag(event: MouseEvent): void {
    if (!this.isDragging()) return;

    const rect = this.waveformWrapperEl()?.nativeElement.getBoundingClientRect();
    if (rect) {
      let clickX;

      if (this.isDraggingThumb) {
        clickX = event.clientX - rect.left - this.initialClickOffset;
      } else {
        clickX = event.clientX - rect.left;
      }

      clickX = Math.max(0, Math.min(rect.width, clickX));
      const progressPercentage = (clickX / rect.width) * 100;

      this.progressPercentage.set(progressPercentage);
      this.updatePlayerBards();

      // Prevent default to avoid text selection during drag
      event.preventDefault();

      console.log('🔵 onDrag', {
        clientX: event.clientX,
        rectLeft: rect.left,
        isDraggingThumb: this.isDraggingThumb,
        initialClickOffset: this.initialClickOffset,
        clickX,
        rectWidth: rect.width,
        progressPercentage
      });
    }
  }

  stopDragging(): void {
    if (!this.isDragging()) return;

    this.isDragging.set(false);
    this.setProgress(this.progressPercentage());

    this.isDraggingThumb = false;
    this.initialClickOffset = 0;

    console.log('🔵 stopDragging', {
      progressPercentage: this.progressPercentage()
    });
  }
}
