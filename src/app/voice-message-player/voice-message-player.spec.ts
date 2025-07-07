import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VoiceMessagePlayer } from './voice-message-player';

describe('VoiceMessagePlayer', () => {
  let component: VoiceMessagePlayer;
  let fixture: ComponentFixture<VoiceMessagePlayer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VoiceMessagePlayer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VoiceMessagePlayer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
