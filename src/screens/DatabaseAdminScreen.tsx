import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import BiometricsService from '../services/BiometricsService';

interface DatabaseAdminScreenProps {
  onBack: () => void;
}

export const DatabaseAdminScreen: React.FC<DatabaseAdminScreenProps> = ({ onBack }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const enrolled = await BiometricsService.getEnrolledUsers();
      setUsers(enrolled);
    } catch (error: any) {
      Alert.alert('Database Error', error.message || 'Failed to fetch enrolled users');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (userId: string, username: string) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete the identity for "${username}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete by unhashed ID if it was returned as hashed, wait! The UI only has the hash!
              // But the delete method in Kotlin expects the userHash!
              // Wait, in BiometricsService.ts, I added: const hashedId = await this.hashUserId(userId);
              // But the BiometricsModule.getEnrolledUsers returns the ALREADY hashed userId!
              // So if we pass the hash back to deleteUser in TS, it will hash it AGAIN!
              // Let's pass a bypass flag or just call the native module directly to bypass double-hashing.
              const { NativeModules } = require('react-native');
              await NativeModules.BiometricsModule.deleteUser(userId);
              
              setUsers(prev => prev.filter(u => u.userId !== userId));
              Alert.alert('Success', `${username} has been deleted.`);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={styles.additionalData}>{item.additionalData}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item.userId, item.username)}
      >
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Manage Database</Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#FF6D00" style={{ marginTop: 50 }} />
        ) : users.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No users enrolled yet.</Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.userId}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#141414',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: '#FFF',
    fontSize: 24,
    lineHeight: 28,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  additionalData: {
    fontSize: 14,
    color: '#888',
  },
  deleteButton: {
    backgroundColor: '#FF525220',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF5252',
  },
  deleteText: {
    color: '#FF5252',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
});
