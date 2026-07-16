import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, photoTones } from './theme';
import { Post } from './data';
import { useApp } from './state';

// Instagram-style "save to collection" bottom sheet, shared by post detail + home feed.
export function SaveSheet({ post, visible, onClose }: { post: Post; visible: boolean; onClose: () => void }) {
  const { savedPosts, savePost, showToast } = useApp();
  const names = Object.keys(savedPosts);

  const pick = (name: string) => {
    savePost(post, name);
    showToast('saved to ' + name.toLowerCase());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.pill} />
          <Text style={s.title}>Save to collection</Text>
          {names.map((name, i) => {
            const count = savedPosts[name]?.length ?? 0;
            return (
              <Pressable key={name} style={s.row} onPress={() => pick(name)}>
                <View style={[s.swatch, { backgroundColor: photoTones[i % photoTones.length] }]} />
                <Text style={s.rowName}>{name}</Text>
                <Text style={s.rowCount}>{count} fits</Text>
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26,25,22,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 22, paddingTop: 10, paddingBottom: 36,
  },
  pill: { width: 36, height: 4, borderRadius: 999, backgroundColor: colors.line, alignSelf: 'center' },
  title: { fontFamily: fonts.serif, fontSize: 18, color: colors.ink, marginTop: 14, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
  },
  swatch: { width: 40, height: 40, borderRadius: 6 },
  rowName: { fontFamily: fonts.serif, fontSize: 15, color: colors.ink, flex: 1 },
  rowCount: { fontFamily: fonts.sans, fontSize: 10, color: colors.faint, letterSpacing: 0.5 },
});
