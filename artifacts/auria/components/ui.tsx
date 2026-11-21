import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type StyleProp,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/finance';
import { formatMoney, monthLabel, shiftMonth, currentMonthKey } from '@/lib/format';
import type { IconName } from '@/lib/categories';

export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export function tap(kind: 'light' | 'success' | 'warning' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  else void Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
}

export function confirmAction(title: string, body: string, confirmLabel: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${body}`)) onYes();
    return;
  }
  tap('warning');
  Alert.alert(title, body, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onYes },
  ]);
}

export function showError(title: string, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
}

export function useTopInset() {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'web' ? 67 : insets.top;
}
export function useTabBottomPad() {
  const insets = useSafeAreaInsets();
  return (Platform.OS === 'web' ? 84 : 64 + insets.bottom) + 32;
}

type PSProps = PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; children?: React.ReactNode };
export function PressableScale({ style, scaleTo = 0.97, children, onPressIn, onPressOut, ...rest }: PSProps) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        Animated.spring(scale, { toValue: scaleTo, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 0 }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 20, bounciness: 8 }).start();
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

export function ScreenHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: React.ReactNode }) {
  const c = useColors();
  const top = useTopInset();
  return (
    <View style={[s.header, { paddingTop: top + 14 }]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={[s.eyebrow, { color: c.mutedForeground }]}>{eyebrow}</Text> : null}
        <Text style={[s.title, { color: c.foreground }]}>{title}</Text>
      </View>
      {right ? <View style={s.headerRight}>{right}</View> : null}
    </View>
  );
}

export function IconButton({ icon, onPress, label, tone = 'default', testID }: { icon: IconName; onPress: () => void; label: string; tone?: 'default' | 'primary'; testID?: string }) {
  const c = useColors();
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={6}
      scaleTo={0.9}
      style={[s.iconBtn, { backgroundColor: tone === 'primary' ? c.primary : c.card, borderColor: c.border }]}
    >
      <Feather name={icon} size={18} color={tone === 'primary' ? c.primaryForeground : c.foreground} />
    </PressableScale>
  );
}

export function Card({ children, style, tone = 'card' }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: 'card' | 'muted' | 'accent' | 'lagoon' }) {
  const c = useColors();
  const bg = tone === 'card' ? c.card : tone === 'muted' ? c.muted : tone === 'accent' ? c.auraSoft : c.lagoonSoft;
  return <View style={[s.card, { backgroundColor: bg, borderColor: c.border, borderRadius: c.radius }, style]}>{children}</View>;
}

export function Button({
  label, onPress, variant = 'primary', icon, loading, disabled, style, testID,
}: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'aura';
  icon?: IconName; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const c = useColors();
  const bg = { primary: c.primary, secondary: c.secondary, ghost: 'transparent', danger: c.expenseSoft, aura: c.aura }[variant];
  const fg = { primary: c.primaryForeground, secondary: c.secondaryForeground, ghost: c.primary, danger: c.destructive, aura: c.hero }[variant];
  const off = disabled || loading;
  return (
    <PressableScale
      testID={testID}
      disabled={off}
      onPress={() => {
        tap();
        onPress();
      }}
      style={[s.btn, { backgroundColor: bg, opacity: off ? 0.5 : 1, borderColor: variant === 'ghost' ? c.border : 'transparent' }, style]}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : icon ? <Feather name={icon} size={16} color={fg} /> : null}
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </PressableScale>
  );
}

export function Chip({ label, active, onPress, icon, testID }: { label: string; active?: boolean; onPress: () => void; icon?: IconName; testID?: string }) {
  const c = useColors();
  return (
    <PressableScale
      testID={testID}
      onPress={() => {
        tap();
        onPress();
      }}
      scaleTo={0.94}
      style={[s.chip, { backgroundColor: active ? c.primary : c.card, borderColor: active ? c.primary : c.border }]}
    >
      {icon ? <Feather name={icon} size={13} color={active ? c.primaryForeground : c.mutedForeground} /> : null}
      <Text style={[s.chipText, { color: active ? c.primaryForeground : c.foreground }]}>{label}</Text>
    </PressableScale>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const c = useColors();
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useRef(new Animated.Value(idx)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: idx, useNativeDriver: Platform.OS !== 'web', speed: 18, bounciness: 6 }).start();
  }, [idx, x]);
  const segW = w / options.length;
  return (
    <View style={[s.seg, { backgroundColor: c.muted, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }]} onLayout={(e) => setW(e.nativeEvent.layout.width - 8)}>
      {w > 0 ? (
        <Animated.View
          style={[s.segThumb, { width: segW, backgroundColor: c.secondary, transform: [{ translateX: Animated.multiply(x, segW) }] }]}
        />
      ) : null}
      {options.map((o) => (
        <Pressable
          key={o.value}
          style={s.segItem}
          onPress={() => {
            tap();
            onChange(o.value);
          }}
        >
          <Text numberOfLines={1} style={[s.segText, { color: o.value === value ? c.foreground : c.mutedForeground }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Money({ value, currency = 'BRL', style, signed }: { value: number; currency?: string; style?: StyleProp<TextStyle>; signed?: boolean }) {
  const { store } = useFinance();
  const text = store.settings.hideAmounts
    ? (currency === 'BRL' ? 'R$' : currency) + ' ••••'
    : (signed && value > 0 ? '+ ' : '') + formatMoney(value, currency);
  return (
    <Text style={[{ fontFamily: F.semibold, fontVariant: ['tabular-nums'] }, style]} numberOfLines={1} adjustsFontSizeToFit>
      {text}
    </Text>
  );
}

export function EmptyState({ icon, title, body, actionLabel, onAction, secondaryLabel, onSecondary }: {
  icon: IconName; title: string; body: string; actionLabel?: string; onAction?: () => void; secondaryLabel?: string; onSecondary?: () => void;
}) {
  const c = useColors();
  return (
    <View style={[s.empty, { borderColor: c.border, borderRadius: c.radius }]}>
      <View style={[s.emptyHalo, { backgroundColor: c.auraSoft }]}>
        <View style={[s.emptyIcon, { backgroundColor: c.card }]}>
          <Feather name={icon} size={22} color={c.accentForeground} />
        </View>
      </View>
      <Text style={[s.emptyTitle, { color: c.foreground }]}>{title}</Text>
      <Text style={[s.emptyBody, { color: c.mutedForeground }]}>{body}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} icon="plus" style={{ marginTop: 16, alignSelf: 'stretch' }} /> : null}
      {secondaryLabel && onSecondary ? <Button label={secondaryLabel} onPress={onSecondary} variant="ghost" style={{ marginTop: 8, alignSelf: 'stretch' }} /> : null}
    </View>
  );
}

export function Field({ label, error, hint, style, ...props }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const c = useColors();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[s.label, { color: c.mutedForeground }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.mutedForeground + '99'}
        {...props}
        onFocus={(e) => {
          setFocus(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          props.onBlur?.(e);
        }}
        style={[
          s.input,
          { backgroundColor: c.card, color: c.foreground, borderColor: error ? c.destructive : focus ? c.primary : c.input },
          style,
        ]}
      />
      {error ? <Text style={[s.help, { color: c.destructive }]}>{error}</Text> : hint ? <Text style={[s.help, { color: c.mutedForeground }]}>{hint}</Text> : null}
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const c = useColors();
  return (
    <View style={s.section}>
      <Text style={[s.sectionText, { color: c.foreground }]}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[s.sectionAction, { color: c.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Badge({ label, tone = 'muted', icon }: { label: string; tone?: 'muted' | 'lagoon' | 'aura' | 'danger' | 'warning' | 'income'; icon?: IconName }) {
  const c = useColors();
  const map = {
    muted: [c.muted, c.mutedForeground],
    lagoon: [c.lagoonSoft, c.primary],
    aura: [c.auraSoft, c.accentForeground],
    danger: [c.expenseSoft, c.destructive],
    warning: [c.warningSoft, c.warning],
    income: [c.incomeSoft, c.income],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      {icon ? <Feather name={icon} size={11} color={fg} /> : null}
      <Text style={[s.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ ratio, tone = 'primary', height = 8 }: { ratio: number; tone?: 'primary' | 'danger' | 'warning' | 'aura' | 'income'; height?: number }) {
  const c = useColors();
  const [w, setW] = useState(0);
  const r = Math.max(0, Math.min(1, ratio));
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: r, useNativeDriver: Platform.OS !== 'web', speed: 6, bounciness: 4 }).start();
  }, [r, v]);
  const color = { primary: c.primary, danger: c.destructive, warning: c.warning, aura: c.aura, income: c.income }[tone];
  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.muted, overflow: 'hidden' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Animated.View
          style={{
            width: w, height, borderRadius: height, backgroundColor: color,
            transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-w, 0] }) }],
          }}
        />
      ) : null}
    </View>
  );
}

export function MonthNav() {
  const c = useColors();
  const { month, setMonth } = useFinance();
  const isNow = month === currentMonthKey();
  return (
    <View style={[s.monthNav, { backgroundColor: c.card, borderColor: c.border }]}>
      <Pressable testID="month-prev" hitSlop={10} onPress={() => { tap(); setMonth(shiftMonth(month, -1)); }} style={s.monthArrow}>
        <Feather name="chevron-left" size={18} color={c.foreground} />
      </Pressable>
      <Pressable onPress={() => { if (!isNow) { tap(); setMonth(currentMonthKey()); } }} style={{ flex: 1, alignItems: 'center' }}>
        <Text style={[s.monthText, { color: c.foreground }]}>{monthLabel(month)}</Text>
        {!isNow ? <Text style={[s.monthHint, { color: c.primary }]}>voltar para o mês atual</Text> : null}
      </Pressable>
      <Pressable testID="month-next" hitSlop={10} onPress={() => { tap(); setMonth(shiftMonth(month, 1)); }} style={s.monthArrow}>
        <Feather name="chevron-right" size={18} color={c.foreground} />
      </Pressable>
    </View>
  );
}

export function Notice({ tone = 'info', title, body, actionLabel, onAction }: { tone?: 'info' | 'danger' | 'warning'; title: string; body?: string; actionLabel?: string; onAction?: () => void }) {
  const c = useColors();
  const bg = tone === 'danger' ? c.expenseSoft : tone === 'warning' ? c.warningSoft : c.lagoonSoft;
  const fg = tone === 'danger' ? c.destructive : tone === 'warning' ? c.warning : c.primary;
  return (
    <View style={[s.notice, { backgroundColor: bg, borderRadius: c.radius - 4 }]}>
      <Feather name={tone === 'info' ? 'info' : 'alert-circle'} size={16} color={fg} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[s.noticeTitle, { color: c.foreground }]}>{title}</Text>
        {body ? <Text style={[s.noticeBody, { color: c.mutedForeground }]}>{body}</Text> : null}
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={6} style={{ marginTop: 8 }}>
            <Text style={[s.sectionAction, { color: fg }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const v = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(v, { toValue: 0.4, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ height, width, borderRadius: 8, backgroundColor: c.muted, opacity: v }, style]} />;
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 14, gap: 12 },
  eyebrow: { fontFamily: F.medium, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontFamily: F.bold, fontSize: 30, letterSpacing: -1 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  card: { padding: 16, borderWidth: StyleSheet.hairlineWidth },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, height: 50, borderRadius: 25, borderWidth: 1 },
  btnText: { fontFamily: F.semibold, fontSize: 15 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, height: 34, borderRadius: 17, borderWidth: 1 },
  chipText: { fontFamily: F.medium, fontSize: 13 },
  seg: { flexDirection: 'row', padding: 4, borderRadius: 14 },
  segThumb: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 10, shadowColor: '#05080C', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  segItem: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segText: { fontFamily: F.semibold, fontSize: 13 },
  empty: { alignItems: 'center', padding: 24, borderWidth: 1, borderStyle: 'dashed' },
  emptyHalo: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: F.semibold, fontSize: 17, textAlign: 'center', letterSpacing: -0.3 },
  emptyBody: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  label: { fontFamily: F.medium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 7 },
  input: { fontFamily: F.regular, fontSize: 16, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  help: { fontFamily: F.regular, fontSize: 12, marginTop: 6, lineHeight: 17 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
  sectionText: { fontFamily: F.semibold, fontSize: 17, letterSpacing: -0.3 },
  sectionAction: { fontFamily: F.semibold, fontSize: 13 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  badgeText: { fontFamily: F.semibold, fontSize: 11 },
  monthNav: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  monthArrow: { paddingHorizontal: 14, paddingVertical: 6 },
  monthText: { fontFamily: F.semibold, fontSize: 15, textTransform: 'capitalize' },
  monthHint: { fontFamily: F.medium, fontSize: 11, marginTop: 1 },
  notice: { flexDirection: 'row', gap: 10, padding: 14 },
  noticeTitle: { fontFamily: F.semibold, fontSize: 14 },
  noticeBody: { fontFamily: F.regular, fontSize: 13, lineHeight: 19, marginTop: 3 },
});
