import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StatusBar, Text, View } from 'react-native';

import type { MainScreenUi } from '../mainScreenUi';
import { styles } from '../styles/mainScreenStyles';

type UploadKind = 'license' | 'qualification' | 'vehicle';

export type BecomeDriverUploadItem = {
  id: string;
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
  kind: UploadKind;
  /** License card side when `kind === 'license'` (photos only). */
  licenseSide?: 'front' | 'back';
};

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  onBack: () => void;
  onSubmit: (uploads: BecomeDriverUploadItem[]) => Promise<void>;
};

const MAX_UPLOADS = 8;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

/** Qualification: PDF and DOCX only. */
const QUALIFICATION_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

const IMAGE_PICKER_COMMON: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: 0.72,
};

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatLicenseSubtitle(item: BecomeDriverUploadItem): string {
  if (item.kind !== 'license') return item.kind.toUpperCase();
  const side = item.licenseSide === 'back' ? 'Back' : item.licenseSide === 'front' ? 'Front' : 'License';
  return `LICENSE • ${side}`;
}

export function BecomeDriverScreen({ ui, isDark, onBack, onSubmit }: Props) {
  const [uploads, setUploads] = useState<BecomeDriverUploadItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const counts = useMemo(() => {
    return {
      license: uploads.filter((item) => item.kind === 'license').length,
      qualification: uploads.filter((item) => item.kind === 'qualification').length,
      vehicle: uploads.filter((item) => item.kind === 'vehicle').length,
    };
  }, [uploads]);

  const hasLicenseFront = uploads.some((i) => i.kind === 'license' && i.licenseSide === 'front');
  const hasLicenseBack = uploads.some((i) => i.kind === 'license' && i.licenseSide === 'back');

  const canAddMore = uploads.length < MAX_UPLOADS;
  const isComplete =
    hasLicenseFront && hasLicenseBack && counts.qualification > 0 && counts.vehicle > 0;
  const totalUploadBytes = uploads.reduce((sum, item) => sum + (item.size ?? 0), 0);

  const assertCanAdd = (prev: BecomeDriverUploadItem[], next: BecomeDriverUploadItem): boolean => {
    if ((next.size ?? 0) > MAX_FILE_BYTES) {
      Alert.alert(
        'File too large',
        `Each file must be ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB or less.`
      );
      return false;
    }
    if (prev.length >= MAX_UPLOADS) {
      Alert.alert('Upload limit reached', `You can upload up to ${MAX_UPLOADS} files.`);
      return false;
    }
    const nextTotalBytes = prev.reduce((sum, item) => sum + (item.size ?? 0), 0) + (next.size ?? 0);
    if (nextTotalBytes > MAX_TOTAL_BYTES) {
      Alert.alert(
        'Upload set too large',
        `Total upload size must stay under ${Math.round(MAX_TOTAL_BYTES / (1024 * 1024))}MB.`
      );
      return false;
    }
    return true;
  };

  const pushUpload = (next: BecomeDriverUploadItem) => {
    setUploads((prev) => {
      if (!assertCanAdd(prev, next)) return prev;
      return [next, ...prev];
    });
  };

  const pushLicensePhoto = (side: 'front' | 'back', image: ImagePicker.ImagePickerAsset) => {
    const nextItem: BecomeDriverUploadItem = {
      id: `${Date.now()}-${Math.random()}`,
      kind: 'license',
      licenseSide: side,
      name: image.fileName ?? `License (${side === 'front' ? 'front' : 'back'})`,
      uri: image.uri,
      mimeType: image.mimeType ?? 'image/jpeg',
      size: image.fileSize ?? undefined,
    };
    setUploads((prev) => {
      const base = prev.filter((p) => !(p.kind === 'license' && p.licenseSide === side));
      if (!assertCanAdd(base, nextItem)) return prev;
      return [nextItem, ...base];
    });
  };

  const pushVehiclePhoto = (image: ImagePicker.ImagePickerAsset) => {
    const nextItem: BecomeDriverUploadItem = {
      id: `${Date.now()}-${Math.random()}`,
      kind: 'vehicle',
      name: image.fileName ?? 'Vehicle photo',
      uri: image.uri,
      mimeType: image.mimeType ?? 'image/jpeg',
      size: image.fileSize ?? undefined,
    };
    setUploads((prev) => {
      const base = prev.filter((p) => p.kind !== 'vehicle');
      if (!assertCanAdd(base, nextItem)) return prev;
      return [nextItem, ...base];
    });
  };

  const pickDocumentQualification = async () => {
    if (!canAddMore) {
      Alert.alert('Upload limit reached', `You can upload up to ${MAX_UPLOADS} files.`);
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: [...QUALIFICATION_TYPES],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const doc = result.assets[0];
    if (!doc) return;
    pushUpload({
      id: `${Date.now()}-${Math.random()}`,
      kind: 'qualification',
      name: doc.name ?? 'Document',
      uri: doc.uri,
      mimeType: doc.mimeType ?? undefined,
      size: doc.size ?? undefined,
    });
  };

  const ensureLibraryPermission = async (): Promise<boolean> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos permission needed', 'Please allow photo library access to choose images.');
      return false;
    }
    return true;
  };

  const ensureCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera needed', 'Please allow camera access to take photos.');
      return false;
    }
    return true;
  };

  const launchLicenseCamera = async (side: 'front' | 'back') => {
    if (!(await ensureCameraPermission())) return;
    const result = await ImagePicker.launchCameraAsync(IMAGE_PICKER_COMMON);
    if (result.canceled) return;
    const image = result.assets[0];
    if (!image) return;
    pushLicensePhoto(side, image);
  };

  const launchLicenseLibrary = async (side: 'front' | 'back') => {
    if (!(await ensureLibraryPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      ...IMAGE_PICKER_COMMON,
      selectionLimit: 1,
    });
    if (result.canceled) return;
    const image = result.assets[0];
    if (!image) return;
    pushLicensePhoto(side, image);
  };

  const pickLicenseSide = (side: 'front' | 'back') => {
    const label = side === 'front' ? 'front' : 'back';
    Alert.alert(`Driver license (${label})`, 'Choose how to add this photo.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take photo', onPress: () => void launchLicenseCamera(side) },
      { text: 'Photo library', onPress: () => void launchLicenseLibrary(side) },
    ]);
  };

  const launchVehicleCamera = async () => {
    if (!(await ensureCameraPermission())) return;
    const result = await ImagePicker.launchCameraAsync(IMAGE_PICKER_COMMON);
    if (result.canceled) return;
    const image = result.assets[0];
    if (!image) return;
    pushVehiclePhoto(image);
  };

  const launchVehicleLibrary = async () => {
    if (!(await ensureLibraryPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      ...IMAGE_PICKER_COMMON,
      selectionLimit: 1,
    });
    if (result.canceled) return;
    const image = result.assets[0];
    if (!image) return;
    pushVehiclePhoto(image);
  };

  const pickVehiclePhoto = () => {
    Alert.alert('Vehicle photo', 'Choose how to add your vehicle photo.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take photo', onPress: () => void launchVehicleCamera() },
      { text: 'Photo library', onPress: () => void launchVehicleLibrary() },
    ]);
  };

  const removeUpload = (id: string) => {
    setUploads((prev) => prev.filter((item) => item.id !== id));
  };

  const submit = async () => {
    if (!isComplete) {
      Alert.alert(
        'Missing uploads',
        'Please add license photos (front and back), at least one qualification file (PDF or DOCX), and a vehicle photo.'
      );
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(uploads);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.editProfileHeader, { backgroundColor: ui.panelBg, borderBottomWidth: 1, borderBottomColor: ui.divider }]}>
        <Pressable style={styles.editProfileHeaderSide} onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={ui.text} />
        </Pressable>
        <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Become a Driver</Text>
        <View style={styles.editProfileHeaderSide} />
      </View>

      <ScrollView style={styles.editProfileScroll} contentContainerStyle={styles.editProfileScrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 20 }]}>
          Upload up to {MAX_UPLOADS} files: license (2 photos), qualification (PDF/DOCX), and vehicle photo.
        </Text>
        <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 4 }]}>
          Max {Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB per file, {Math.round(MAX_TOTAL_BYTES / (1024 * 1024))}MB total.
        </Text>

        <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
          <Pressable style={[styles.settingsRow, { paddingVertical: 16 }]} onPress={() => pickLicenseSide('front')}>
            <Ionicons name="id-card-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Driver license — front (photo)</Text>
            <Ionicons name="camera-outline" size={20} color={ui.textMuted} />
          </Pressable>
          <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
          <Pressable style={[styles.settingsRow, { paddingVertical: 16 }]} onPress={() => pickLicenseSide('back')}>
            <Ionicons name="id-card-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Driver license — back (photo)</Text>
            <Ionicons name="camera-outline" size={20} color={ui.textMuted} />
          </Pressable>
          <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
          <Pressable style={[styles.settingsRow, { paddingVertical: 16 }]} onPress={() => void pickDocumentQualification()}>
            <Ionicons name="document-text-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Qualification (PDF or DOCX)</Text>
            <Ionicons name="add-circle-outline" size={20} color={ui.textMuted} />
          </Pressable>
          <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
          <Pressable style={[styles.settingsRow, { paddingVertical: 16 }]} onPress={() => pickVehiclePhoto()}>
            <Ionicons name="car-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Vehicle photo</Text>
            <Ionicons name="camera-outline" size={20} color={ui.textMuted} />
          </Pressable>
        </View>

        <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider, marginTop: 16 }]}>
          <View style={[styles.settingsRow, { paddingVertical: 14 }]}>
            <Ionicons name="checkmark-done-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>
              Progress: {uploads.length}/{MAX_UPLOADS} uploaded
            </Text>
          </View>
          <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
          <View style={[styles.settingsRow, { paddingVertical: 12 }]}>
            <Text style={[styles.settingsRowLabel, { color: ui.textMuted }]}>
              License front: {hasLicenseFront ? 'Added' : 'Missing'}
            </Text>
            <Text style={[styles.settingsRowLabel, { color: ui.textMuted }]}>
              License back: {hasLicenseBack ? 'Added' : 'Missing'}
            </Text>
          </View>
          <View style={[styles.settingsRow, { paddingVertical: 12 }]}>
            <Text style={[styles.settingsRowLabel, { color: ui.textMuted }]}>
              Qualifications: {counts.qualification > 0 ? 'Added' : 'Missing'}
            </Text>
            <Text style={[styles.settingsRowLabel, { color: ui.textMuted }]}>
              Vehicle photo: {counts.vehicle > 0 ? 'Added' : 'Missing'}
            </Text>
          </View>
          <View style={[styles.settingsRow, { paddingVertical: 12 }]}>
            <Text style={[styles.settingsRowLabel, { color: ui.textMuted }]}>Payload Size</Text>
            <Text style={[styles.settingsRowLabel, { color: ui.textMuted }]}>
              {formatBytes(totalUploadBytes)} / {formatBytes(MAX_TOTAL_BYTES)}
            </Text>
          </View>
        </View>

        {uploads.length > 0 ? (
          <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider, marginTop: 16 }]}>
            {uploads.map((item, index) => (
              <View key={item.id}>
                <View style={[styles.settingsRow, { paddingVertical: 14 }]}>
                  <Ionicons
                    name={item.kind === 'vehicle' || item.kind === 'license' ? 'image-outline' : 'document-outline'}
                    size={20}
                    color={ui.text}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingsRowLabel, { color: ui.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={{ color: ui.textMuted, fontSize: 12 }}>
                      {item.kind === 'license'
                        ? `${formatLicenseSubtitle(item)} • ${formatBytes(item.size)}`
                        : `${item.kind.toUpperCase()} • ${formatBytes(item.size)}`}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeUpload(item.id)} hitSlop={8}>
                    <Ionicons name="close-circle-outline" size={20} color={ui.textMuted} />
                  </Pressable>
                </View>
                {index < uploads.length - 1 ? <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} /> : null}
              </View>
            ))}
          </View>
        ) : null}

        <Pressable
          style={[styles.modalSaveBtn, { marginTop: 18, opacity: !isComplete || submitting ? 0.5 : 1 }]}
          disabled={!isComplete || submitting}
          onPress={() => void submit()}
        >
          <Text style={styles.modalSaveBtnText}>
            {submitting ? 'Submitting...' : 'Submit Driver Application'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
