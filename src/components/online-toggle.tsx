/**
 * The worker's availability switch — the single most consequential control in
 * the app, so it gets to be the biggest thing on the screen.
 *
 * A stock `<Switch>` was doing this job before, which understated it badly:
 * flipping this decides whether the phone rings for the next two minutes. The
 * pill states it in words, the knob pulses while live, and the track carries
 * the same green ramp used everywhere else "earning" is the message.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PulseRing } from '@/components/motion';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Ease } from '@/constants/motion';
import { Duration, Gradients, Motion, Radius, Shadow, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TRACK_HEIGHT = 64;
const PAD = 6;
const KNOB = TRACK_HEIGHT - PAD * 2;

interface OnlineToggleProps {
  online: boolean;
  onChange: (online: boolean) => void;
  disabled?: boolean;
  onLabel: string;
  offLabel: string;
  /** Track width. Defaults to the screen minus the wide gutter on both sides. */
  width?: number;
}

export function OnlineToggle({
  online,
  onChange,
  disabled = false,
  onLabel,
  offLabel,
  width,
}: OnlineToggleProps) {
  const theme = useTheme();
  const { width: screen } = useWindowDimensions();
  const track = width ?? screen - 48;

  // One driver for the knob, the track fill and both labels, so nothing can
  // land out of step with the rest.
  const on = useDerivedValue(() => (online ? 1 : 0), [online]);

  const knob = useAnimatedStyle(() => ({
    transform: [
      { translateX: withSpring(on.value * (track - KNOB - PAD * 2), Motion.toggle) },
    ],
  }));

  const fill = useAnimatedStyle(() => ({
    opacity: withTiming(on.value, { duration: Duration.base, easing: Ease.out }),
  }));

  const onText = useAnimatedStyle(() => ({
    opacity: withTiming(on.value, { duration: Duration.fast, easing: Ease.out }),
  }));

  const offText = useAnimatedStyle(() => ({
    opacity: withTiming(1 - on.value, { duration: Duration.fast, easing: Ease.out }),
  }));

  return (
    <PressableScale
      onPress={() => onChange(!online)}
      disabled={disabled}
      scaleTo={0.985}
      accessibilityLabel={online ? onLabel : offLabel}
      style={[
        styles.track,
        { width: track, backgroundColor: theme.fillTertiary },
        online ? Shadow.card : null,
      ]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.fill, fill]}>
        <LinearGradient
          colors={[Gradients.online[0], Gradients.online[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Knob on the left when offline, so the label reads to its right. */}
      <Animated.View style={[styles.knobWrap, knob]}>
        <PulseRing size={KNOB} color="#FFFFFF" active={online} to={1.6} />
        <View style={[styles.knob, { backgroundColor: online ? '#FFFFFF' : theme.surface }]}>
          <Icon
            name={online ? 'radio' : 'moon'}
            size={24}
            color={online ? theme.success : theme.textMuted}
          />
        </View>
      </Animated.View>

      <Animated.Text
        numberOfLines={1}
        style={[Type.bodyEmphasized, styles.label, styles.labelOff, { color: theme.textSecondary }, offText]}>
        {offLabel}
      </Animated.Text>
      <Animated.Text
        numberOfLines={1}
        style={[Type.bodyEmphasized, styles.label, styles.labelOn, styles.onColor, onText]}>
        {onLabel}
      </Animated.Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: Radius.pill,
    padding: PAD,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: { borderRadius: Radius.pill, overflow: 'hidden' },
  knobWrap: { width: KNOB, height: KNOB },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { position: 'absolute', top: 0, bottom: 0, textAlignVertical: 'center', lineHeight: TRACK_HEIGHT },
  // Offline: knob left, label right of it.
  labelOff: { left: PAD + KNOB + 16, right: 20, textAlign: 'left' },
  // Online: knob right, label left of it.
  labelOn: { left: 24, right: PAD + KNOB + 16, textAlign: 'left' },
  onColor: { color: '#FFFFFF' },
});
