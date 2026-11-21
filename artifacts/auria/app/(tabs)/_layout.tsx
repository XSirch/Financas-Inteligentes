import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import type { IconName } from '@/lib/categories';

const TABS: { name: string; title: string; icon: IconName; sf: string; sfOn: string }[] = [
  { name: 'index', title: 'Visão', icon: 'sun', sf: 'sun.horizon', sfOn: 'sun.horizon.fill' },
  { name: 'movimentos', title: 'Movimentos', icon: 'list', sf: 'list.bullet', sfOn: 'list.bullet' },
  { name: 'plano', title: 'Plano', icon: 'target', sf: 'target', sfOn: 'target' },
  { name: 'patrimonio', title: 'Patrimônio', icon: 'layers', sf: 'square.stack.3d.up', sfOn: 'square.stack.3d.up.fill' },
  { name: 'agente', title: 'Agente', icon: 'message-circle', sf: 'bubble.left', sfOn: 'bubble.left.fill' },
];

function NativeTabLayout() {
  return (
    <NativeTabs>
      {TABS.map((t) => (
        <NativeTabs.Trigger key={t.name} name={t.name}>
          <NativeTabs.Trigger.Icon sf={{ default: t.sf, selected: t.sfOn } as never} />
          <NativeTabs.Trigger.Label>{t.title}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const c = useColors();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : c.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: c.card }]} />
          ),
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: 'center' }}>
                <Feather name={t.icon} size={21} color={color} />
                <View style={{ width: 4, height: 4, borderRadius: 2, marginTop: 3, backgroundColor: focused ? c.aura : 'transparent' }} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}
