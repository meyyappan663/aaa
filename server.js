const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Cache responses for 10 minutes
const cache = new NodeCache({ stdTTL: 600 });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please slow down.' },
});
app.use('/api/', apiLimiter);

const ANILIST = 'https://graphql.anilist.co';

// ── GraphQL helper ──────────────────────────────────────────────────────────
async function gql(query, variables = {}, cacheKey = null) {
  if (cacheKey) {
    const hit = cache.get(cacheKey);
    if (hit) return hit;
  }
  const { data } = await axios.post(
    ANILIST,
    { query, variables },
    { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 12000 }
  );
  if (data.errors) throw new Error(data.errors[0].message);
  if (cacheKey) cache.set(cacheKey, data.data);
  return data.data;
}

// ── Shared fragment ─────────────────────────────────────────────────────────
const MEDIA_FIELDS = `
  id
  title { romaji english native }
  coverImage { extraLarge large medium }
  bannerImage
  description(asHtml: false)
  episodes
  duration
  status
  season
  seasonYear
  format
  genres
  averageScore
  meanScore
  popularity
  trending
  favourites
  studios(isMain: true) { nodes { name } }
  source
  countryOfOrigin
  trailer { id site }
  startDate { year month day }
  endDate   { year month day }
  rankings  { rank type context allTime season year }
  relations { edges { relationType(version:2) node { id title{romaji} coverImage{medium} } } }
  tags { name rank isMediaSpoiler }
  siteUrl
`;

const PAGE_INFO = `pageInfo { total currentPage lastPage hasNextPage perPage }`;

// ── ROUTES ──────────────────────────────────────────────────────────────────

// GET /api/trending  — currently airing, sorted by trending
app.get('/api/trending', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  try {
    const data = await gql(
      `query($page:Int){
        Page(page:$page, perPage:20){
          ${PAGE_INFO}
          media(type:ANIME, sort:TRENDING_DESC, status:RELEASING){${MEDIA_FIELDS}}
        }
      }`,
      { page },
      `trending_${page}`
    );
    res.json(normalisePageResponse(data.Page));
  } catch (e) {
    console.error('trending:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/top  — all-time top by score
app.get('/api/top', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  try {
    const data = await gql(
      `query($page:Int){
        Page(page:$page, perPage:20){
          ${PAGE_INFO}
          media(type:ANIME, sort:SCORE_DESC, format_in:[TV,MOVIE,OVA,ONA]){${MEDIA_FIELDS}}
        }
      }`,
      { page },
      `top_${page}`
    );
    res.json(normalisePageResponse(data.Page));
  } catch (e) {
    console.error('top:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/popular  — most popular by member count
app.get('/api/popular', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  try {
    const data = await gql(
      `query($page:Int){
        Page(page:$page, perPage:20){
          ${PAGE_INFO}
          media(type:ANIME, sort:POPULARITY_DESC){${MEDIA_FIELDS}}
        }
      }`,
      { page },
      `popular_${page}`
    );
    res.json(normalisePageResponse(data.Page));
  } catch (e) {
    console.error('popular:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/seasonal  — current season
app.get('/api/seasonal', async (req, res) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const seasons = ['WINTER','WINTER','SPRING','SPRING','SPRING','SUMMER','SUMMER','SUMMER','FALL','FALL','FALL','WINTER'];
  const season = seasons[month - 1];
  const year = now.getFullYear();
  try {
    const data = await gql(
      `query($season:MediaSeason,$year:Int){
        Page(page:1, perPage:30){
          ${PAGE_INFO}
          media(type:ANIME, season:$season, seasonYear:$year, sort:POPULARITY_DESC){${MEDIA_FIELDS}}
        }
      }`,
      { season, year },
      `seasonal_${season}_${year}`
    );
    res.json(normalisePageResponse(data.Page));
  } catch (e) {
    console.error('seasonal:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/upcoming  — next season
app.get('/api/upcoming', async (req, res) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const seasonOrder = ['WINTER','SPRING','SUMMER','FALL'];
  const currentSeasons = ['WINTER','WINTER','SPRING','SPRING','SPRING','SUMMER','SUMMER','SUMMER','FALL','FALL','FALL','WINTER'];
  const currentSeason = currentSeasons[month - 1];
  let year = now.getFullYear();
  let nextIdx = (seasonOrder.indexOf(currentSeason) + 1) % 4;
  if (nextIdx === 0) year++;
  const nextSeason = seasonOrder[nextIdx];
  try {
    const data = await gql(
      `query($season:MediaSeason,$year:Int){
        Page(page:1, perPage:30){
          ${PAGE_INFO}
          media(type:ANIME, season:$season, seasonYear:$year, sort:POPULARITY_DESC, status:NOT_YET_RELEASED){${MEDIA_FIELDS}}
        }
      }`,
      { season: nextSeason, year },
      `upcoming_${nextSeason}_${year}`
    );
    res.json(normalisePageResponse(data.Page));
  } catch (e) {
    console.error('upcoming:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/search?q=...
app.get('/api/search', async (req, res) => {
  const q = req.query.q;
  const page = parseInt(req.query.page) || 1;
  if (!q) return res.status(400).json({ error: 'q is required' });
  try {
    const data = await gql(
      `query($search:String,$page:Int){
        Page(page:$page, perPage:20){
          ${PAGE_INFO}
          media(type:ANIME, search:$search, sort:SEARCH_MATCH){${MEDIA_FIELDS}}
        }
      }`,
      { search: q, page },
      `search_${q.toLowerCase()}_${page}`
    );
    res.json(normalisePageResponse(data.Page));
  } catch (e) {
    console.error('search:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/anime/:id  — single anime detail
app.get('/api/anime/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const data = await gql(
      `query($id:Int){
        Media(id:$id, type:ANIME){
          ${MEDIA_FIELDS}
          characters(sort:ROLE, perPage:12){
            edges {
              role
              node { id name{full} image{large medium} }
              voiceActors(language:JAPANESE){ id name{full} image{large} }
            }
          }
        }
      }`,
      { id },
      `anime_${id}`
    );
    res.json({ data: normaliseMedia(data.Media) });
  } catch (e) {
    console.error('detail:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/genres — hardcoded AniList genres
app.get('/api/genres', async (req, res) => {
  const genres = [
    'Action','Adventure','Comedy','Drama','Ecchi','Fantasy','Horror',
    'Mahou Shoujo','Mecha','Music','Mystery','Psychological','Romance',
    'Sci-Fi','Slice of Life','Sports','Supernatural','Thriller',
  ];
  res.json({ data: genres.map((name, i) => ({ mal_id: i + 1, name, count: null })) });
});

// GET /api/genre/:name — anime by genre name (passed as query ?name=)
app.get('/api/genre/:name', async (req, res) => {
  const genre = decodeURIComponent(req.params.name);
  const page  = parseInt(req.query.page) || 1;
  try {
    const data = await gql(
      `query($genre:String,$page:Int){
        Page(page:$page, perPage:20){
          ${PAGE_INFO}
          media(type:ANIME, genre:$genre, sort:POPULARITY_DESC){${MEDIA_FIELDS}}
        }
      }`,
      { genre, page },
      `genre_${genre.toLowerCase()}_${page}`
    );
    res.json(normalisePageResponse(data.Page));
  } catch (e) {
    console.error('genre:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Normalise helpers ────────────────────────────────────────────────────────
function normaliseMedia(m) {
  if (!m) return null;
  return {
    mal_id: m.id,
    anilist_id: m.id,
    title: m.title?.romaji || m.title?.english || 'Unknown',
    title_english: m.title?.english || null,
    title_japanese: m.title?.native || null,
    images: {
      jpg: {
        image_url:       m.coverImage?.medium || '',
        small_image_url: m.coverImage?.medium || '',
        large_image_url: m.coverImage?.extraLarge || m.coverImage?.large || '',
      }
    },
    banner: m.bannerImage || null,
    synopsis: m.description ? m.description.replace(/<[^>]*>/g, '') : null,
    type: formatMap(m.format),
    episodes: m.episodes || null,
    duration: m.duration ? `${m.duration} min per ep` : null,
    status: statusMap(m.status),
    score: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
    scored_by: m.favourites || null,
    rank: m.rankings?.find(r => r.allTime && r.type === 'RATED')?.rank || null,
    popularity: m.rankings?.find(r => r.allTime && r.type === 'POPULAR')?.rank || null,
    members: m.popularity || null,
    season: m.season?.toLowerCase() || null,
    year: m.seasonYear || m.startDate?.year || null,
    aired: { prop: { from: { year: m.startDate?.year } } },
    studios: (m.studios?.nodes || []).map(s => ({ name: s.name })),
    genres: (m.genres || []).map((g, i) => ({ mal_id: i + 1, name: g })),
    source: m.source?.replace(/_/g, ' ') || null,
    rating: null,
    trailer: m.trailer?.site === 'youtube'
      ? { embed_url: `https://www.youtube.com/embed/${m.trailer.id}` }
      : null,
    siteUrl: m.siteUrl || null,
    characters: (m.characters?.edges || []).map(e => ({
      role: e.role === 'MAIN' ? 'Main' : e.role === 'SUPPORTING' ? 'Supporting' : 'Background',
      character: {
        name: e.node?.name?.full || '',
        images: { jpg: { image_url: e.node?.image?.large || e.node?.image?.medium || '' } },
      },
      voice_actors: (e.voiceActors || []).map(va => ({
        person: { name: va.name?.full || '', images: { jpg: { image_url: va.image?.large || '' } } },
        language: 'Japanese',
      })),
    })),
  };
}

function normalisePageResponse(page) {
  return {
    data: (page.media || []).map(normaliseMedia),
    pagination: {
      last_visible_page: page.pageInfo?.lastPage || 1,
      has_next_page: page.pageInfo?.hasNextPage || false,
      current_page: page.pageInfo?.currentPage || 1,
      items: { count: page.media?.length || 0, total: page.pageInfo?.total || 0 },
    },
  };
}

function formatMap(f) {
  const m = { TV:'TV', TV_SHORT:'TV Short', MOVIE:'Movie', SPECIAL:'Special', OVA:'OVA', ONA:'ONA', MUSIC:'Music' };
  return m[f] || f || 'TV';
}

function statusMap(s) {
  const m = {
    RELEASING: 'Currently Airing',
    FINISHED: 'Finished Airing',
    NOT_YET_RELEASED: 'Not yet aired',
    CANCELLED: 'Cancelled',
    HIATUS: 'On Hiatus',
  };
  return m[s] || s || '';
}

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`🎌 Anime site running at http://localhost:${PORT}`));
