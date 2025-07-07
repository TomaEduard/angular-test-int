import {Component, signal} from '@angular/core';
import {VoiceMessagePlayer} from "./voice-message-player/voice-message-player";

@Component({
  selector: 'app-root',
  imports: [VoiceMessagePlayer],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  mp3Files = ['sample-12s.mp3', 'file_example_MP3_700KB.mp3'];

  selectedMp3 = signal(this.mp3Files[1]);

  selectMp3(fileName: string): void {
    this.selectedMp3.set(fileName);
  }
}
