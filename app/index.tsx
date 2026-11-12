import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, View } from 'react-native';
import { supabase } from './lib/supabase';

const _heartSvg = `<svg fill="#C9A84C" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45.92 45.92"><path d="M36.871,18.851c-1.927-1.924-4.447-2.886-6.97-2.886c-2.51,0-5.021,0.954-6.941,2.858c-1.921-1.905-4.431-2.858-6.941-2.858c-2.522,0-5.045,0.962-6.971,2.886c-3.849,3.848-3.849,10.09,0,13.939c0.19,0.187,9.322,9.276,12.685,12.623c0.338,0.338,0.783,0.507,1.227,0.507c0.443,0,0.889-0.169,1.227-0.507c3.363-3.347,12.496-12.438,12.686-12.623C40.722,28.941,40.722,22.698,36.871,18.851z M24.96,31.72v3.484c0,1.358-0.641,2.462-2,2.462c-1.359,0-2-1.104-2-2.462V31.72c-1-0.661-1.39-1.596-1.39-2.641c0-2,1.505-3.621,3.505-3.621s3.332,1.621,3.332,3.621C26.407,30.124,25.96,31.059,24.96,31.72z"/></svg>`;
const HEART_URI = `data:image/svg+xml,${encodeURIComponent(_heartSvg)}`;

const _shackleSvg = `<svg fill="#C9A84C" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45.92 45.92"><path d="M16.596,6.637C18.296,4.937,20.557,4,22.96,4c4.963,0,9,4.037,9,9v0.143c1.404,0.226,2.756,0.666,4,1.333V13c0-7.168-5.832-13-13-13c-3.472,0-6.736,1.353-9.192,3.807c-0.781,0.781-0.781,2.048-0.001,2.829C14.548,7.417,15.814,7.416,16.596,6.637z"/></svg>`;
const SHACKLE_URI = `data:image/svg+xml,${encodeURIComponent(_shackleSvg)}`;

function UnlockingLogo() {
  const shackleY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.parallel([
          Animated.timing(shackleY, { toValue: -10, duration: 480, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.08, duration: 480, useNativeDriver: true }),
        ]),
        Animated.delay(350),
        Animated.parallel([
          Animated.timing(shackleY, { toValue: 0, duration: 480, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 480, useNativeDriver: true }),
        ]),
        Animated.delay(900),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View style={{ width: 88, height: 88 }}>
        <Image source={{ uri: HEART_URI }} style={{ position: 'absolute', width: 88, height: 88 }} />
        <Animated.View style={{ position: 'absolute', width: 88, height: 88, transform: [{ translateY: shackleY }] }}>
          <Image source={{ uri: SHACKLE_URI }} style={{ width: 88, height: 88 }} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default function Index() {
  const [target, setTarget] = useState<null | '/auth' | '/onboarding' | '/(tabs)/swipe'>(null);

  useEffect(() => {
    const minDelay = new Promise<void>(r => setTimeout(r, 300));
    const authCheck = supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return '/auth' as const;
      const { data: p } = await supabase
        .from('profiles')
        .select('profile_completed')
        .eq('id', session.user.id)
        .single();
      return p?.profile_completed ? ('/(tabs)/swipe' as const) : ('/onboarding' as const);
    });
    Promise.all([minDelay, authCheck]).then(([, t]) => setTarget(t));
  }, []);

  if (!target) {
    return (
      <View style={{ flex: 1, backgroundColor: '#080808', justifyContent: 'center', alignItems: 'center' }}>
        <UnlockingLogo />
      </View>
    );
  }

  return <Redirect href={target as any} />;
}
