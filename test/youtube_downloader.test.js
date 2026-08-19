import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import YouTubeDownloader from '../modules/youtube_downloader.js';

describe('YouTubeDownloader Module Tests', () => {
  it('should extract correct 11-character video ID from YouTube Shorts', () => {
    const id = YouTubeDownloader.extractVideoId('https://youtube.com/shorts/22_erqyii-c?si=nS5PK9ibKW2iVcAG');
    assert.equal(id, '22_erqyii-c');
  });

  it('should extract correct ID from standard YouTube watch URL', () => {
    const id = YouTubeDownloader.extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(id, 'dQw4w9WgXcQ');
  });

  it('should extract correct ID from YouTube Music URL', () => {
    const id = YouTubeDownloader.extractVideoId('https://music.youtube.com/watch?v=dQw4w9WgXcQ&feature=share');
    assert.equal(id, 'dQw4w9WgXcQ');
  });

  it('should extract correct ID from shortlinks (youtu.be)', () => {
    const id = YouTubeDownloader.extractVideoId('https://youtu.be/jNQXAC9IVRw?si=abc');
    assert.equal(id, 'jNQXAC9IVRw');
  });

  it('should return null for invalid or empty URLs', () => {
    assert.equal(YouTubeDownloader.extractVideoId(''), null);
    assert.equal(YouTubeDownloader.extractVideoId('https://instagram.com/reel/123'), null);
  });
});
