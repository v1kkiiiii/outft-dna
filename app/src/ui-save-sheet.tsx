import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, photoTones } from './theme';
import { Post } from './data';
import { useApp } from './state';

// Instagram-style "save to collection" bottom sheet, shared by post detail + home feed.
// Collections are entirely user-created — there are no premade boards. The
// first-ever save skips straight to naming a collection; every later save
// offers existing collections plus a "new collection" option.
export function SaveSheet({ post, visible, onClose }: { post: Post; visible: boolean; onClose: () => void }) {
  const { savedPosts, savePost, showToast } = useApp();
  const names = Object.keys(savedPosts);
  const [creating, setCreating] = useState(names.length === 0);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (visible) {
      setCreating(names.length === 0);
      setNewName('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pick = (name: string) => {
    savePost(post, name);
    showToast('saved to ' + name.toLowerCase());
    onClose();
  };

  const createAndSave = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    pick(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.pill} />
            <Text style={s.title}>
              {creating ? (names.length === 0 ? 'Name your first collection' : 'New collection') : 'Save to collection'}
            </Text>

            {creating ? (
              <View style={{ gap: 14 }}>
                <TextInput
                  style={s.input}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="e.g. Night out"
                  placeholderTextColor={colors.faint}
                  autoFocus
                  autoCapitalize="words"
                  onSubmitEditing={createAndSave}
                />
                <Pressable
                  style={[s.createBtn, !newName.trim() && { opacity: 0.4 }]}
                  onPress={createAndSave}
                  disabled={!newName.trim()}
                >
                  <Text style={s.createBtnText}>Create & save</Text>
                </Pressable>
                {names.length > 0 && (
                  <Pressable onPress={() => setCreating(false)} hitSlop={8}>
                    <Text style={s.cancelText}>choose an existing collection instead</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
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
                <Pressable style={s.row} onPress={() => setCreating(true)}>
                  <View style={[s.swatch, s.swatchNew]}>
                    <Text style={s.plus}>+</Text>
                  </View>
                  <Text style={s.rowName}>New collection</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </KeyboardAvoidingView>
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
  swatchNew: { backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
  plus: { fontSize: 18, color: colors.ink },
  rowName: { fontFamily: fonts.serif, fontSize: 15, color: colors.ink, flex: 1 },
  rowCount: { fontFamily: fonts.sans, fontSize: 10, color: colors.faint, letterSpacing: 0.5 },
  input: {
    borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 10,
    fontFamily: fonts.serif, fontSize: 17, color: colors.ink,
  },
  createBtn: { backgroundColor: colors.ink, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  createBtnText: { fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 1.5, color: colors.paper, textTransform: 'uppercase' },
  cancelText: { fontFamily: fonts.sans, fontSize: 11, color: colors.faint, textAlign: 'center' },
});
