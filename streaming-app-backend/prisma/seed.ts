import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool as any)
const prisma = new PrismaClient({ adapter })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function randomFloat(min: number, max: number) {
  return Math.random() * (max - min) + min
}
function randomBool(prob = 0.5) {
  return Math.random() < prob
}
function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}
function randomDate(daysAgo: number) {
  const d = new Date()
  d.setDate(d.getDate() - randomInt(0, daysAgo))
  d.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59))
  return d
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GENRES = ['Pop', 'R&B', 'Rap/Hip-Hop', 'EDM', 'Rock', 'Lo-Fi', 'Indie', 'Acoustic']

const SONG_TITLES: Record<string, string[]> = {
  'Pop': [
    'Neon Heartbeat', 'Sugar Rush', 'Midnight Glow', 'Electric Dreams',
    'Candy Cloud', 'Skyfall Pop', 'Golden Hour', 'Pulse & Shine',
    'Daydream Disco', 'Pastel Radio', 'Sunshine Protocol', 'Pop Altitude',
  ],
  'R&B': [
    'Silk & Smoke', 'Velvet Morning', 'After Midnight', 'Slow Burn',
    'Moody Groove', 'Brown Sugar', 'Smooth Criminal Vibes', 'Soul Drip',
    'Honeyed Tears', 'Late Night Feeling', 'Tender Echoes', 'Love in HD',
  ],
  'Rap/Hip-Hop': [
    'Street Gospel', 'Concrete Jungle', 'Bars & Bruises', 'Flow State',
    'Asphalt Anthem', 'Grind Season', 'Cipher Code', 'Hood Oracle',
    'Trap Weather', 'Block Testimonies', 'Freestyle Chronicle', 'Wave Rider',
  ],
  'EDM': [
    'Bassline Zero', 'Synth Surge', 'Drop Protocol', 'Rave Nation',
    'Circuit Breaker', '4AM Festival', 'Laser Grid', 'Digital Pulse',
    'Euphoria Engine', 'Kick Drum Heaven', 'Warp Drive', 'Frequency Lock',
  ],
  'Rock': [
    'Thunder Hollow', 'Distortion Diary', 'Amp Overload', 'Scream & Static',
    'Garage Gods', 'Broken Strings', 'Riff Sermon', 'Stage Dive',
    'Wall of Sound', 'Feedback Loop', 'Chrome & Leather', 'Power Chord',
  ],
  'Lo-Fi': [
    'Rainy Coffee Shop', 'Study with Me', 'Late Night Pixels',
    'Dusty Vinyl', 'Sleepy Town', 'Analog Dreams', 'Bedroom Session',
    'Chill Wavelength', 'Cloudy Afternoon', 'Nostalgic Loop',
    'Winter Tape', 'Soft Hours',
  ],
  'Indie': [
    'Wildflower Season', 'Broken Telescope', 'Paper Towns',
    'Faded Polaroid', 'Overgrown Garden', 'Cassette Heart',
    'Dorm Room Echoes', 'Rooftop Serenade', 'Bicycle Yellow',
    'Sunrise Apartment', 'Linen & Dew', 'Honest Hours',
  ],
  'Acoustic': [
    'Porch Light', 'Open Tuning', 'Campfire Prayer',
    'String Theory', 'Wooden Echo', 'Barefoot Melody',
    'Dawn Chorus', 'Hymn for the Road', 'Fingerpick Diary',
    'Simple Room', 'Cedar Soul', 'Clear Water Song',
  ],
}

const AVATAR_URLS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=',
  'https://api.dicebear.com/7.x/personas/svg?seed=',
  'https://api.dicebear.com/7.x/micah/svg?seed=',
]

const COVER_PALETTES = [
  '3d4a5c', 'a8dadc', '457b9d', '1d3557',
  'e63946', 'f4a261', '2a9d8f', '264653',
  'ffb703', 'fb8500', '023047', '219ebc',
  '8338ec', '3a86ff', 'ff006e', 'fb5607',
]

const BIOS = [
  'Music is life 🎵', 'Late night listener 🌙', 'Beats and vibes only',
  'If it sounds good, I\'m in.', 'Playlist curator by day, dreamer by night.',
  'R&B soul with a hip hop heart.', 'Just here for the bass drops 🔊',
  'Genre-fluid music head.', 'Making every commute a concert.',
  'My AirPods never die.', 'Lofi when I work, bops when I play.',
  'Sound is my second language.', 'Always got the aux.', 'Indie first, always.',
  'Acoustic sessions & good coffee ☕',
]

const COMMENT_BANK = [
  'this song is fire 🔥', 'late night vibe fr', 'crazy beat on this one',
  'been on repeat for 3 days straight', 'slaps different at 2am',
  'who is this artist?? need more', 'the drop hits so hard 💀',
  'this got me through my exam', 'absolute masterpiece', 'underrated af',
  'goosebumps every time', 'produced this in a dream i think',
  'the vocals are insane 😤', 'my workout anthem rn', 'chill mode activated',
  'why is nobody talking about this', 'playlist-worthy for sure',
  'this beat is giving everything', 'emotional damage 💔', 'lofi perfection',
  'the guitar part 😭', 'genre is irrelevant this is just good', 'top tier taste',
  'sending this to everyone I know', 'this deserves more plays',
]

const PLAYLIST_NAMES = [
  'Chill Vibes Only', 'Late Night Drive', 'Workout Beast Mode',
  'Sad Songs for the Soul', 'Focus & Flow', 'Weekend Party Hits',
  'Morning Warmup', 'Rainy Day Playlist', 'Road Trip Ready',
  'Bedroom Pop Collection', 'Hype Anthems', 'Soul & R&B Essentials',
  'EDM Festival Bangers', 'Acoustic Sunday', 'Hip Hop Classics',
  'Indie Discoveries', 'Lofi Study Session', 'Summer Bops',
  'Evening Unwind', 'Deep Focus Mode',
]

const USERNAME_PREFIXES = [
  'usuk_fan', 'lofi_girl', 'rap_listener', 'music_head', 'beat_seeker',
  'wave_rider', 'groove_lord', 'indie_soul', 'bass_drop', 'melody_chase',
  'vinyl_ghost', 'drum_echo', 'synth_kid', 'neon_ears', 'chill_mode',
  'audio_wolf', 'pixel_beat', 'track_hunter', 'rnb_vibes', 'edm_rave',
]

const AUDIO_SAMPLES = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  'https://samplelib.com/lib/preview/mp3/sample-3s.mp3',
  'https://samplelib.com/lib/preview/mp3/sample-6s.mp3',
  'https://samplelib.com/lib/preview/mp3/sample-9s.mp3',
  'https://samplelib.com/lib/preview/mp3/sample-12s.mp3',
  'https://samplelib.com/lib/preview/mp3/sample-15s.mp3',
]

const RECOMMENDATION_SOURCES = [
  'genre_based', 'collaborative_filter', 'trending', 'for_you',
  'similar_tracks', 'autoplay', 'following_activity',
]

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting comprehensive seed...\n')

  // ═══════════════════════════════════════════════════════════════════
  // 1. GENRES
  // ═══════════════════════════════════════════════════════════════════
  console.log('📂 Seeding genres...')
  const genreMap: Record<string, { id: number; name: string }> = {}
  for (const name of GENRES) {
    const g = await prisma.genre.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    genreMap[name] = g
  }
  console.log(`   ✅ ${GENRES.length} genres ready\n`)

  // ═══════════════════════════════════════════════════════════════════
  // 2. USERS  (50 users)
  // ═══════════════════════════════════════════════════════════════════
  console.log('👥 Seeding users...')
  const passwordHash = await bcrypt.hash('123456', 10)
  const users: any[] = []

  const usedUsernames = new Set<string>()
  const usedEmails = new Set<string>()

  for (let i = 0; i < 50; i++) {
    const prefix = randomItem(USERNAME_PREFIXES)
    let username = `${prefix}_${String(i + 1).padStart(2, '0')}`
    // guarantee uniqueness
    while (usedUsernames.has(username)) username += '_x'
    usedUsernames.add(username)

    const email = `user${i + 1}@test.com`
    if (usedEmails.has(email)) continue
    usedEmails.add(email)

    const avatarBase = randomItem(AVATAR_URLS)
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        username,
        passwordHash,
        fullName: username.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        avatarUrl: `${avatarBase}${username}`,
        bio: randomItem(BIOS),
        emailVerified: true,
        emailVerifiedAt: randomDate(180),
      },
    })
    users.push(user)
  }
  console.log(`   ✅ ${users.length} users created\n`)

  // ═══════════════════════════════════════════════════════════════════
  // 3. SONGS  (200 songs)
  // ═══════════════════════════════════════════════════════════════════
  console.log('🎵 Seeding songs...')
  const songs: any[] = []
  const totalSongs = 200

  for (let i = 0; i < totalSongs; i++) {
    const uploader = randomItem(users)
    const primaryGenre = randomItem(GENRES)
    const titlesForGenre = SONG_TITLES[primaryGenre]
    const baseTitle = randomItem(titlesForGenre)
    const title = `${baseTitle} ${i + 1}`

    // Pick 1-3 secondary genres
    const secondaryGenres = shuffle(GENRES.filter(g => g !== primaryGenre)).slice(0, randomInt(1, 3))
    const allSongGenres = [primaryGenre, ...secondaryGenres]

    const coverColor = randomItem(COVER_PALETTES)
    const duration = randomInt(120, 360)
    const playCount = randomInt(0, 50000)
    const likeCount = Math.floor(playCount * randomFloat(0.01, 0.15))
    const repostCount = Math.floor(likeCount * randomFloat(0.05, 0.3))
    const commentCount = Math.floor(likeCount * randomFloat(0.02, 0.2))

    const song = await prisma.song.create({
      data: {
        title,
        audioUrl: randomItem(AUDIO_SAMPLES),
        imageUrl: `https://placehold.co/400x400/${coverColor}/ffffff?text=${encodeURIComponent(primaryGenre)}`,
        duration,
        userId: uploader.id,
        privacy: randomBool(0.9) ? 'PUBLIC' : 'PRIVATE',
        playCount,
        likeCount,
        repostCount,
        commentCount,
        aiPrimaryGenre: primaryGenre,
        finalPrimaryGenre: primaryGenre,
        aiStatus: 'done',
        aiModelVersion: 'v2.1',
        genreSource: 'ai',
        genreConfidence: randomFloat(0.7, 0.99),
        aiGenresJson: GENRES.map(g => ({
          name: g,
          score: g === primaryGenre ? randomFloat(0.75, 0.99) : randomFloat(0.05, 0.45),
        })),
        description: randomBool(0.6)
          ? `${primaryGenre} track — produced with love. ${randomItem(COMMENT_BANK)}`
          : null,
        createdAt: randomDate(365),
      },
    })
    songs.push(song)

    // SongGenre links
    for (let gi = 0; gi < allSongGenres.length; gi++) {
      const gName = allSongGenres[gi]
      await prisma.songGenre.create({
        data: {
          songId: song.id,
          genreId: genreMap[gName].id,
          score: gName === primaryGenre ? randomFloat(0.75, 0.99) : randomFloat(0.1, 0.5),
          isPrimary: gi === 0,
        },
      }).catch(() => { })
    }

    // Update uploader trackCount
    await prisma.user.update({
      where: { id: uploader.id },
      data: { trackCount: { increment: 1 } },
    })
  }
  console.log(`   ✅ ${songs.length} songs created\n`)

  // ═══════════════════════════════════════════════════════════════════
  // 4. FOLLOW  (~300 follow relations)
  // ═══════════════════════════════════════════════════════════════════
  console.log('🤝 Seeding follows...')
  let followCount = 0
  const followSet = new Set<string>()

  for (const u of users) {
    const targetCount = randomInt(3, 12)
    const targets = shuffle(users.filter(x => x.id !== u.id)).slice(0, targetCount)
    for (const t of targets) {
      const key = `${u.id}:${t.id}`
      if (followSet.has(key)) continue
      followSet.add(key)
      await prisma.follow.create({
        data: { followerId: u.id, followedId: t.id, status: 'ACCEPTED' },
      }).catch(() => { })
      followCount++
    }
  }

  // Update follower/following counts
  for (const u of users) {
    const followerCount = await prisma.follow.count({ where: { followedId: u.id, status: 'ACCEPTED' } })
    const followingCount = await prisma.follow.count({ where: { followerId: u.id, status: 'ACCEPTED' } })
    await prisma.user.update({ where: { id: u.id }, data: { followerCount, followingCount } })
  }
  console.log(`   ✅ ${followCount} follow relations created\n`)

  // ═══════════════════════════════════════════════════════════════════
  // 5. PLAY HISTORY  (20–100 listens per user)
  // ═══════════════════════════════════════════════════════════════════
  console.log('▶️  Seeding play history...')
  let playTotal = 0
  const publicSongs = songs.filter(s => s.privacy === 'PUBLIC')

  for (const user of users) {
    const listenCount = randomInt(20, 100)
    const pool = shuffle(publicSongs).slice(0, listenCount)

    for (const song of pool) {
      const duration = song.duration ?? 200
      const completionRate = parseFloat(randomFloat(0.15, 1.0).toFixed(2))
      const durationPlayed = Math.floor(duration * completionRate)

      await prisma.playHistory.create({
        data: {
          userId: user.id,
          songId: song.id,
          durationPlayed,
          completionRate,
          source: randomItem(RECOMMENDATION_SOURCES),
          playedAt: randomDate(90),
        },
      })
      playTotal++
    }
  }
  console.log(`   ✅ ${playTotal} play history records created\n`)

  // ═══════════════════════════════════════════════════════════════════
  // 6. LIKES  (realistic — ~3,000–5,000 total)
  // ═══════════════════════════════════════════════════════════════════
  console.log('❤️  Seeding likes...')
  let likeTotal = 0
  const likeSet = new Set<string>()

  for (const user of users) {
    const likedSongs = shuffle(publicSongs).slice(0, randomInt(20, 60))
    for (const song of likedSongs) {
      const key = `${user.id}:${song.id}`
      if (likeSet.has(key)) continue
      likeSet.add(key)
      await prisma.like.create({
        data: { userId: user.id, songId: song.id, createdAt: randomDate(180) },
      }).catch(() => { })
      likeTotal++
    }
  }
  console.log(`   ✅ ${likeTotal} likes created\n`)

  // ═══════════════════════════════════════════════════════════════════
  // 7. REPOSTS
  // ═══════════════════════════════════════════════════════════════════
  console.log('🔁 Seeding reposts...')
  let repostTotal = 0
  const repostSet = new Set<string>()

  for (const user of users) {
    const repostedSongs = shuffle(publicSongs).slice(0, randomInt(3, 15))
    for (const song of repostedSongs) {
      const key = `${user.id}:${song.id}`
      if (repostSet.has(key)) continue
      repostSet.add(key)
      await prisma.repost.create({
        data: { userId: user.id, songId: song.id, createdAt: randomDate(90) },
      }).catch(() => { })
      repostTotal++
    }
  }
  console.log(`   ✅ ${repostTotal} reposts created\n`)

  // ═══════════════════════════════════════════════════════════════════
  // 8. COMMENTS
  // ═══════════════════════════════════════════════════════════════════
  console.log('💬 Seeding comments...')
  let commentTotal = 0

  for (const user of users) {
    const commentedSongs = shuffle(publicSongs).slice(0, randomInt(5, 20))
    for (const song of commentedSongs) {
      await prisma.comment.create({
        data: {
          userId: user.id,
          songId: song.id,
          content: randomItem(COMMENT_BANK),
          createdAt: randomDate(120),
        },
      })
      commentTotal++
    }
  }
  console.log(`   ✅ ${commentTotal} comments created\n`)

  // ═══════════════════════════════════════════════════════════════════
  // 9. PLAYLISTS  (named playlists, 10–30 songs each)
  // ═══════════════════════════════════════════════════════════════════
  console.log('📋 Seeding playlists...')
  let playlistTotal = 0

  for (const user of shuffle(users).slice(0, 35)) {
    const playlistCount = randomInt(1, 3)
    const usedNames = new Set<string>()

    for (let p = 0; p < playlistCount; p++) {
      let plName = randomItem(PLAYLIST_NAMES)
      while (usedNames.has(plName)) plName = randomItem(PLAYLIST_NAMES)
      usedNames.add(plName)

      const playlist = await prisma.playlist.create({
        data: {
          title: plName,
          userId: user.id,
          privacy: randomBool(0.8) ? 'PUBLIC' : 'PRIVATE',
          createdAt: randomDate(200),
        },
      })

      const songCount = randomInt(10, 30)
      const selectedSongs = shuffle(publicSongs).slice(0, songCount)
      const addedSongIds = new Set<string>()

      for (let si = 0; si < selectedSongs.length; si++) {
        const s = selectedSongs[si]
        if (addedSongIds.has(s.id)) continue
        addedSongIds.add(s.id)
        await prisma.playlistSong.create({
          data: { playlistId: playlist.id, songId: s.id, orderIndex: si },
        }).catch(() => { })
      }
      playlistTotal++
    }
  }
  console.log(`   ✅ ${playlistTotal} playlists created\n`)

  // ═══════════════════════════════════════════════════════════════════
  // 10. USER GENRE PREFERENCES
  // ═══════════════════════════════════════════════════════════════════
  console.log('🎨 Seeding user genre preferences...')
  let prefTotal = 0

  for (const user of users) {
    // Each user has 2–6 favourite genres with varying scores
    const preferredGenres = shuffle(GENRES).slice(0, randomInt(2, 6))
    for (const gName of preferredGenres) {
      await prisma.userGenrePreference.upsert({
        where: { userId_genreId: { userId: user.id, genreId: genreMap[gName].id } },
        update: {},
        create: {
          userId: user.id,
          genreId: genreMap[gName].id,
          score: parseFloat(randomFloat(0.4, 1.0).toFixed(3)),
        },
      }).catch(() => { })
      prefTotal++
    }
  }
  console.log(`   ✅ ${prefTotal} genre preferences created\n`)

  // ═══════════════════════════════════════════════════════════════════
  // 11. RECOMMENDATION LOGS
  // ═══════════════════════════════════════════════════════════════════
  console.log('🤖 Seeding recommendation logs...')
  let recTotal = 0

  for (const user of users) {
    const recCount = randomInt(15, 40)
    const recSongs = shuffle(publicSongs).slice(0, recCount)

    for (const song of recSongs) {
      const clicked = randomBool(0.45)
      const played = clicked && randomBool(0.7)

      await prisma.recommendationLog.create({
        data: {
          userId: user.id,
          songId: song.id,
          source: randomItem(RECOMMENDATION_SOURCES),
          score: parseFloat(randomFloat(0.3, 0.99).toFixed(4)),
          clicked,
          played,
          recommendedAt: randomDate(60),
        },
      })
      recTotal++
    }
  }
  console.log(`   ✅ ${recTotal} recommendation log entries created\n`)

  // ═══════════════════════════════════════════════════════════════════
  // 12. NOTIFICATIONS  (from interactions above)
  // ═══════════════════════════════════════════════════════════════════
  console.log('🔔 Seeding notifications...')
  let notiTotal = 0

  // Like notifications (sample ~300)
  const likedPairs = shuffle(
    [...likeSet].map(k => k.split(':'))
  ).slice(0, 300)

  for (const [actorId, songId] of likedPairs) {
    const song = songs.find(s => s.id === songId)
    if (!song) continue
    if (song.userId === actorId) continue // no self-notif
    await prisma.notification.create({
      data: {
        type: 'LIKE_SONG',
        actorId,
        userId: song.userId,
        referenceId: songId,
        createdAt: randomDate(90),
      },
    }).catch(() => { })
    notiTotal++
  }

  // Follow notifications (sample ~150)
  const followPairs = shuffle([...followSet].map(k => k.split(':'))).slice(0, 150)
  for (const [followerId, followedId] of followPairs) {
    await prisma.notification.create({
      data: {
        type: 'FOLLOW',
        actorId: followerId,
        userId: followedId,
        createdAt: randomDate(120),
      },
    }).catch(() => { })
    notiTotal++
  }

  // Comment notifications (sample ~200)
  const recentComments = await prisma.comment.findMany({ take: 200 })
  for (const c of recentComments) {
    const song = songs.find(s => s.id === c.songId)
    if (!song || song.userId === c.userId) continue
    await prisma.notification.create({
      data: {
        type: 'COMMENT_SONG',
        actorId: c.userId,
        userId: song.userId,
        referenceId: String(c.id),
        createdAt: c.createdAt,
      },
    }).catch(() => { })
    notiTotal++
  }

  console.log(`   ✅ ${notiTotal} notifications created\n`)

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════')
  console.log('✅  SEED COMPLETE 🚀')
  console.log('═══════════════════════════════════════')
  console.log(`👤  Users        : ${users.length}`)
  console.log(`🎵  Songs        : ${songs.length}`)
  console.log(`🤝  Follows      : ${followCount}`)
  console.log(`▶️   Play history : ${playTotal}`)
  console.log(`❤️   Likes        : ${likeTotal}`)
  console.log(`🔁  Reposts      : ${repostTotal}`)
  console.log(`💬  Comments     : ${commentTotal}`)
  console.log(`📋  Playlists    : ${playlistTotal}`)
  console.log(`🎨  Genre prefs  : ${prefTotal}`)
  console.log(`🤖  Rec logs     : ${recTotal}`)
  console.log(`🔔  Notifs       : ${notiTotal}`)
  console.log('═══════════════════════════════════════')
  console.log('\n🔑  Login with any user:')
  console.log('   email    : user1@test.com  (up to user50@test.com)')
  console.log('   password : 123456')
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
