import React, { useEffect, useRef, useState } from 'react';
import {
  TRANSPARENT_PNG, spriteSources, resolvePokeapiSprite, resolvePokeapiSpriteShiny,
  SPRITE_ANIMATION_CACHE, animationSources, resolvePokeapiAnimation, preloadImage,
} from '../../lib/sprites.js';

function Sprite({ mon, size=42, alt='', forceShiny=false, playOnHover=false }) {
  const [shinyGlobal, setShinyGlobal] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shinySprites') ?? 'false'); } catch { return false; }
  });
  useEffect(() => {
    const onChange = (e) => setShinyGlobal(!!e?.detail?.enabled);
    window.addEventListener('shiny-global-changed', onChange);
    return () => window.removeEventListener('shiny-global-changed', onChange);
  }, []);
  const useShiny = !!(shinyGlobal || forceShiny);
  const srcs = React.useMemo(()=> spriteSources(mon, { shiny: useShiny }), [mon, useShiny]);
  const [idx, setIdx] = useState(0);
  const [pokeSrc, setPokeSrc] = useState(null);
  const [triedPokeApi, setTriedPokeApi] = useState(false);
  useEffect(()=>{
    setIdx(0); setPokeSrc(null); setTriedPokeApi(false);
    const noDex = mon && (mon.dex == null && mon.id == null);
    if (noDex) {
      setTriedPokeApi(true);
      const resolver = useShiny ? resolvePokeapiSpriteShiny : resolvePokeapiSprite;
      resolver(mon).then((s) => { if (s) setPokeSrc(s); }).catch(()=>{});
    }
  }, [mon, useShiny]);
  const staticSrc = pokeSrc || srcs[idx] || TRANSPARENT_PNG;

  const enableAnimation = !!playOnHover;
  const [wantsAnimation, setWantsAnimation] = useState(false);
  const [animationSrc, setAnimationSrc] = useState(null);
  const animationApiTriedRef = useRef(false);
  const monSignature = React.useMemo(() => {
    if (!mon) return 'null';
    const parts = [];
    if (mon.id != null) parts.push(`id:${mon.id}`);
    if (mon.slug) parts.push(`slug:${mon.slug}`);
    if (mon.name) parts.push(`name:${mon.name}`);
    return parts.join('|') || 'anon';
  }, [mon]);
  useEffect(() => {
    if (!enableAnimation) return;
    animationApiTriedRef.current = false;
    setAnimationSrc(prev => (prev !== null ? null : prev));
  }, [enableAnimation, monSignature, useShiny]);
  useEffect(() => {
    if (!enableAnimation && wantsAnimation) {
      setWantsAnimation(false);
    }
  }, [enableAnimation, wantsAnimation]);
  const animationSrcs = React.useMemo(() => (
    enableAnimation ? animationSources(mon, { shiny: useShiny }) : []
  ), [enableAnimation, mon, useShiny]);
  const animationCacheKey = React.useMemo(() => {
    if (!enableAnimation || !mon) return '';
    const parts = [useShiny ? 'shiny' : 'normal'];
    if (mon.id != null) parts.push(`id:${mon.id}`);
    if (mon.slug) parts.push(`slug:${mon.slug}`);
    if (!mon.slug && mon.formSlug) parts.push(`slug:${mon.formSlug}`);
    if (mon.name) parts.push(`name:${mon.name}`);
    return parts.join('|');
  }, [enableAnimation, mon, useShiny]);
  useEffect(() => {
    if (!enableAnimation) return;
    if (!wantsAnimation) return;
    if (!mon) return;
    if (animationSrc) return;

    let cancelled = false;
    const cacheKey = animationCacheKey;

    if (cacheKey && SPRITE_ANIMATION_CACHE.has(cacheKey)) {
      const cached = SPRITE_ANIMATION_CACHE.get(cacheKey);
      if (cached) setAnimationSrc(cached);
      return;
    }

    const load = async () => {
      for (const candidate of animationSrcs) {
        if (!candidate) continue;
        try {
          await preloadImage(candidate);
          if (cancelled) return;
          if (cacheKey) SPRITE_ANIMATION_CACHE.set(cacheKey, candidate);
          setAnimationSrc(candidate);
          return;
        } catch {}
      }

      if (!animationApiTriedRef.current) {
        animationApiTriedRef.current = true;
        try {
          const resolved = await resolvePokeapiAnimation(mon, { shiny: useShiny });
          if (cancelled) return;
          if (resolved) {
            try {
              await preloadImage(resolved);
              if (cancelled) return;
              if (cacheKey) SPRITE_ANIMATION_CACHE.set(cacheKey, resolved);
              setAnimationSrc(resolved);
              return;
            } catch {}
          }
        } catch {}
      }

      if (!cancelled && cacheKey && !SPRITE_ANIMATION_CACHE.has(cacheKey)) {
        SPRITE_ANIMATION_CACHE.set(cacheKey, null);
      }
    };

    load();

    return () => { cancelled = true; };
  }, [enableAnimation, wantsAnimation, mon, useShiny, animationSrc, animationSrcs, animationCacheKey]);
  const displayedSrc = enableAnimation && wantsAnimation && animationSrc ? animationSrc : staticSrc;

  const handleError = () => {
    if (enableAnimation && wantsAnimation && animationSrc) {
      if (animationCacheKey) SPRITE_ANIMATION_CACHE.set(animationCacheKey, null);
      animationApiTriedRef.current = false;
      setAnimationSrc(null);
      return;
    }
    if (idx < srcs.length - 1) {
      setIdx(idx + 1);
    } else if (!triedPokeApi && mon) {
      setTriedPokeApi(true);
      const resolver = useShiny ? resolvePokeapiSpriteShiny : resolvePokeapiSprite;
      resolver(mon).then((s) => { if (s) setPokeSrc(s); }).catch(()=>{});
    }
  };

  return (
    <img
      src={displayedSrc}
      alt={alt || mon?.name || ''}
      style={{
        width: size,
        height: size,
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain',
        imageRendering: 'pixelated'
      }}
      onError={handleError}
      onMouseEnter={enableAnimation ? () => setWantsAnimation(true) : undefined}
      onMouseLeave={enableAnimation ? () => setWantsAnimation(false) : undefined}
    />
  );
}

export default Sprite;
