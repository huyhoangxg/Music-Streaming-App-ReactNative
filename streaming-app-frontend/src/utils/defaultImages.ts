export const DEFAULT_SONG_IMAGE_URL =
  'https://lh7-rt.googleusercontent.com/docsz/AD_4nXczbbtwTVkSSprOErZVS60gZa_MbQJi2LnYWpKpQtvz8yDqdIcCJzzOBK7_D42sMCiDybJDivoGOEE6JB_sgq3xTwIa2pQF0iyktOUw4CbK6tYx1aucVF4S1649SryiaEYiSd6Hbg?key=oVwJm0GWQeRqGP0qoG4MOJFL';

export const DEFAULT_USER_AVATAR_URL =
  'https://upload.wikimedia.org/wikipedia/commons/f/f7/Facebook_default_male_avatar.gif';

export function resolveSongImageUrl(imageUrl?: string | null) {
  const normalized = typeof imageUrl === 'string' ? imageUrl.trim() : '';
  return normalized || DEFAULT_SONG_IMAGE_URL;
}

export function resolveUserAvatarUrl(avatarUrl?: string | null) {
  const normalized = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
  return normalized || DEFAULT_USER_AVATAR_URL;
}
