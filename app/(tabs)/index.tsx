import Main from '../../components/main';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}
