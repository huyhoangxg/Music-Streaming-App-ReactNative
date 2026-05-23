import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import Constants from 'expo-constants';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:5000`;
const PLAYBACK_STATUS_UPDATE_INTERVAL_MS = 500;

const PlayerContext = createContext<any>(null);
export const usePlayer = () => useContext(PlayerContext);

async function configurePlaybackAudioMode() {
  await Audio.setIsEnabledAsync(true);
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });
}

type PlaybackSnapshot = {
  positionMillis: number;
  durationMillis: number;
};

export const PlayerProvider = ({ children }: any) => {
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const currentTrackRef = useRef<any>(null);
  const playbackSnapshotRef = useRef<PlaybackSnapshot>({
    positionMillis: 0,
    durationMillis: 0,
  });
  const reportedPositionMillisRef = useRef(0);
  const hasFinalizedCurrentTrackRef = useRef(false);

  const [queue, setQueue] = useState<any[]>([]);
  const queueRef = useRef<any[]>([]);
  const queueIndexRef = useRef<number>(-1);

  const isPlayingRef = useRef(false);
  const loadingTokenIdRef = useRef<string | null>(null);
  const activeSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const applyPlaybackAudioMode = () => {
      void configurePlaybackAudioMode().catch((error) => {
        console.log('Audio mode setup error:', error);
      });
    };

    applyPlaybackAudioMode();
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        applyPlaybackAudioMode();
        return;
      }

      if (!isPlayingRef.current || !activeSoundRef.current) {
        return;
      }

      void configurePlaybackAudioMode()
        .then(async () => {
          const activeSound = activeSoundRef.current;
          if (!activeSound || !isPlayingRef.current) {
            return;
          }

          const status = await activeSound.getStatusAsync();
          if (status.isLoaded && !status.isPlaying) {
            await activeSound.playAsync();
          }
        })
        .catch((error) => {
          console.log('Background playback keepalive error:', error);
        });
    });

    return () => {
      appStateSubscription.remove();
    };
  }, []);

  const resetPlayerState = async () => {
    loadingTokenIdRef.current = null;

    const activeSound = activeSoundRef.current;
    activeSoundRef.current = null;
    setSound(null);

    if (activeSound) {
      try {
        await activeSound.unloadAsync();
      } catch (_error) {}
    }

    currentTrackRef.current = null;
    setCurrentTrack(null);
    setIsPlaying(false);
    setProgress(0);
    setIsFullScreen(false);
    setQueue([]);
    queueRef.current = [];
    queueIndexRef.current = -1;
    playbackSnapshotRef.current = { positionMillis: 0, durationMillis: 0 };
    reportedPositionMillisRef.current = 0;
    hasFinalizedCurrentTrackRef.current = true;
  };

  const removeTrackFromPlayer = async (songId?: string) => {
    if (!songId) {
      return;
    }

    if (currentTrackRef.current?.id === songId) {
      await resetPlayerState();
      return;
    }

    const currentQueue = queueRef.current;
    const removedIndex = currentQueue.findIndex((track) => track.id === songId);
    if (removedIndex === -1) {
      return;
    }

    const nextQueue = currentQueue.filter((track) => track.id !== songId);
    queueRef.current = nextQueue;
    setQueue(nextQueue);

    if (nextQueue.length === 0) {
      queueIndexRef.current = -1;
    } else if (removedIndex < queueIndexRef.current) {
      queueIndexRef.current -= 1;
    }
  };

  useEffect(() => {
    currentTrackRef.current = currentTrack;
    if (!currentTrack) {
      playbackSnapshotRef.current = { positionMillis: 0, durationMillis: 0 };
      reportedPositionMillisRef.current = 0;
      hasFinalizedCurrentTrackRef.current = false;
    }
  }, [currentTrack]);

  useEffect(() => {
    const deletedSubscription = DeviceEventEmitter.addListener(
      'TRACK_DELETED',
      ({ songId }: { songId?: string } = {}) => {
        void removeTrackFromPlayer(songId);
      },
    );
    const resetSubscription = DeviceEventEmitter.addListener('PLAYER_RESET', () => {
      void resetPlayerState();
    });

    return () => {
      deletedSubscription.remove();
      resetSubscription.remove();
    };
  }, []);

  const reportPlayHistory = async ({
    track,
    completed = false,
    finalize = false,
  }: {
    track?: any;
    completed?: boolean;
    finalize?: boolean;
  } = {}) => {
    const targetTrack = track ?? currentTrackRef.current;

    if (!targetTrack?.id) {
      return;
    }

    if (finalize) {
      hasFinalizedCurrentTrackRef.current = true;
    }

    const snapshot = playbackSnapshotRef.current;
    const finalPositionMillis = completed
      ? Math.max(snapshot.positionMillis, snapshot.durationMillis)
      : snapshot.positionMillis;
    const deltaMillis = Math.max(0, finalPositionMillis - reportedPositionMillisRef.current);
    const playedSeconds = Math.floor(deltaMillis / 1000);

    if (playedSeconds <= 0 && !completed) {
      if (finalize) {
        playbackSnapshotRef.current = { positionMillis: 0, durationMillis: 0 };
        reportedPositionMillisRef.current = 0;
      }
      return;
    }

    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        return;
      }

      await axios.post(
        `${API_URL}/api/interactions/play-history`,
        {
          songId: targetTrack.id,
          playedSeconds,
          isCompleted: completed,
          sourceContext: targetTrack.sourceContext || 'player',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      reportedPositionMillisRef.current = finalPositionMillis;
    } catch (error) {
      console.log('Play history error:', error);
    } finally {
      if (finalize) {
        playbackSnapshotRef.current = { positionMillis: 0, durationMillis: 0 };
        reportedPositionMillisRef.current = 0;
      }
    }
  };

  const fetchAutoplayTrack = async (trackId: string) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        return null;
      }

      const response = await axios.get(`${API_URL}/api/recommendations/autoplay/${trackId}?limit=1`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const nextTrack = Array.isArray(response.data) ? response.data[0] : null;
      if (!nextTrack) {
        return null;
      }

      return {
        ...nextTrack,
        sourceContext: 'autoplay',
      };
    } catch (error) {
      console.log('Autoplay recommendation error:', error);
      return null;
    }
  };

  const playTrack = async (track: any, newQueue?: any[]) => {
    const playToken = Math.random().toString();
    loadingTokenIdRef.current = playToken;

    try {
      await configurePlaybackAudioMode();

      if (
        currentTrackRef.current?.id &&
        currentTrackRef.current.id !== track.id &&
        !hasFinalizedCurrentTrackRef.current
      ) {
        await reportPlayHistory({ track: currentTrackRef.current, finalize: true });
      }

      if (activeSoundRef.current) {
        const oldSound = activeSoundRef.current;
        activeSoundRef.current = null;
        setSound(null);
        try {
          await oldSound.unloadAsync();
        } catch (_error) {}
      }

      playbackSnapshotRef.current = { positionMillis: 0, durationMillis: 0 };
      reportedPositionMillisRef.current = 0;
      hasFinalizedCurrentTrackRef.current = false;
      setProgress(0);

      if (newQueue && newQueue.length > 0) {
        setQueue(newQueue);
        queueRef.current = newQueue;
        const index = newQueue.findIndex((item) => item.id === track.id);
        queueIndexRef.current = index !== -1 ? index : 0;
      } else if (queueRef.current.length === 0) {
        setQueue([track]);
        queueRef.current = [track];
        queueIndexRef.current = 0;
      } else {
        const index = queueRef.current.findIndex((item) => item.id === track.id);
        if (index !== -1) {
          queueIndexRef.current = index;
        }
      }

      currentTrackRef.current = track;
      setCurrentTrack(track);
      setIsPlaying(true);

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: track.audioUrl },
        {
          shouldPlay: true,
          progressUpdateIntervalMillis: PLAYBACK_STATUS_UPDATE_INTERVAL_MS,
        },
        (status: any) => {
          if (status.isLoaded) {
            playbackSnapshotRef.current = {
              positionMillis: status.positionMillis ?? 0,
              durationMillis: status.durationMillis ?? 0,
            };

            if (status.durationMillis) {
              const currentProgress = (status.positionMillis / status.durationMillis) * 100;
              setProgress(currentProgress);
            } else {
              setProgress(0);
            }

            setIsPlaying(status.isPlaying);

            if (status.didJustFinish && !hasFinalizedCurrentTrackRef.current) {
              void reportPlayHistory({ track, completed: true, finalize: true });
              handlePlayNext();
            }
          }
        },
      );

      if (loadingTokenIdRef.current !== playToken) {
        await newSound.unloadAsync();
        return;
      }

      activeSoundRef.current = newSound;
      setSound(newSound);
    } catch (error) {
      console.log('Playback error:', error);
      if (loadingTokenIdRef.current === playToken) {
        activeSoundRef.current = null;
        setSound(null);
        setIsPlaying(false);
      }
    }
  };

  const handlePlayNext = async () => {
    const currentQueue = queueRef.current;
    const currentIndex = queueIndexRef.current;

    if (currentQueue.length > 0 && currentIndex < currentQueue.length - 1) {
      playTrack(currentQueue[currentIndex + 1]);
      return;
    }

    if (currentQueue.length > 0 && currentIndex >= currentQueue.length - 1) {
      playTrack(currentQueue[0]);
      return;
    }

    const seedTrack = currentTrackRef.current;
    if (seedTrack?.id) {
      const autoplayTrack = await fetchAutoplayTrack(seedTrack.id);
      if (autoplayTrack) {
        setQueue([autoplayTrack]);
        queueRef.current = [autoplayTrack];
        queueIndexRef.current = 0;
        playTrack(autoplayTrack, [autoplayTrack]);
        return;
      }
    }

    setIsPlaying(false);
  };

  const handlePlayPrevious = async () => {
    const currentQueue = queueRef.current;
    const currentIndex = queueIndexRef.current;

    if (currentQueue.length > 0 && currentIndex > 0) {
      playTrack(currentQueue[currentIndex - 1]);
    }
  };

  const togglePlayPause = async () => {
    const activeSound = activeSoundRef.current;

    if (!activeSound) {
      return;
    }

    if (isPlaying) {
      await activeSound.pauseAsync();
      await reportPlayHistory({ track: currentTrackRef.current });
      return;
    }

    await configurePlaybackAudioMode();
    await activeSound.playAsync();
  };

  const toggleLike = async (trackId: string) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const isCurrentlyLiked =
        currentTrackRef.current?.id === trackId ? Boolean(currentTrackRef.current?.isLiked) : false;
      const response = isCurrentlyLiked
        ? await axios.delete(`${API_URL}/api/interactions/like/${trackId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        : await axios.post(
            `${API_URL}/api/interactions/like`,
            { songId: trackId },
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );

      DeviceEventEmitter.emit('LIKE_TOGGLED', {
        songId: trackId,
        isLiked: response.data.isLiked,
        likeCount: response.data.likeCount,
      });
    } catch (error) {
      console.log('Like toggle error:', error);
    }
  };

  useEffect(() => {
    const likeSubscription = DeviceEventEmitter.addListener(
      'LIKE_TOGGLED',
      ({ songId, isLiked, likeCount }) => {
        setCurrentTrack((previousTrack: any) => {
          if (!previousTrack || previousTrack.id !== songId) {
            return previousTrack;
          }

          return {
            ...previousTrack,
            isLiked,
            likeCount:
              typeof likeCount === 'number'
                ? likeCount
                : isLiked
                  ? (previousTrack.likeCount || 0) + 1
                  : Math.max(0, (previousTrack.likeCount || 0) - 1),
          };
        });
      },
    );

    return () => likeSubscription.remove();
  }, []);

  useEffect(() => {
    return () => {
      void reportPlayHistory({ track: currentTrackRef.current, finalize: true });

      if (activeSoundRef.current) {
        void activeSoundRef.current.unloadAsync();
      }
    };
  }, []);

  const seekTo = async (percentage: number) => {
    if (!sound) {
      return;
    }

    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        const newPosition = status.durationMillis * percentage;
        await sound.setPositionAsync(newPosition);
        playbackSnapshotRef.current = {
          positionMillis: newPosition,
          durationMillis: status.durationMillis,
        };
        setProgress(percentage * 100);
      }
    } catch (error) {
      console.log('Seek error:', error);
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        progress,
        playTrack,
        playNext: handlePlayNext,
        playPrevious: handlePlayPrevious,
        togglePlayPause,
        toggleLike,
        seekTo,
        isFullScreen,
        setIsFullScreen,
        queue,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};
