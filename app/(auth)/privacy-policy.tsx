import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Política de Privacidad</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Última actualización: 20 de junio de 2026</Text>

        <Section title="1. Introducción">
          UrbanTaxi ("nosotros", "nuestro" o "la aplicación") es una plataforma de movilidad 
          urbana que conecta pasajeros con conductores para servicios de transporte. Esta 
          Política de Privacidad describe cómo recopilamos, usamos, almacenamos y protegemos 
          tu información personal cuando utilizas nuestra aplicación móvil y servicios 
          relacionados.
          {'\n\n'}
          Al registrarte y utilizar UrbanTaxi, aceptas las prácticas descritas en esta 
          política. Si no estás de acuerdo, por favor no utilices la aplicación.
        </Section>

        <Section title="2. Información que Recopilamos">
          <Bold>2.1 Información de cuenta:</Bold> Nombre completo, correo electrónico, 
          número de teléfono, foto de perfil y contraseña encriptada al registrarte.
          También puedes iniciar sesión mediante Google Sign-In.
          {'\n\n'}
          <Bold>2.2 Datos de ubicación:</Bold> Recopilamos tu ubicación GPS en tiempo real 
          para:
          {'\n'}• Mostrar tu posición en el mapa
          {'\n'}• Conectar pasajeros con conductores cercanos
          {'\n'}• Calcular tarifas basadas en distancia
          {'\n'}• Compartir tu ubicación con el conductor durante el viaje (pasajero)
          {'\n'}• Registrar la ruta del viaje para facturación y seguridad
          {'\n\n'}
          <Bold>2.3 Datos de vehículo (conductores):</Bold> Tipo de vehículo, modelo, 
          placa, licencia de conducir y certificado médico.
          {'\n\n'}
          <Bold>2.4 Información de pago:</Bold> Datos de pago móvil y transferencia 
          bancaria para que los conductores reciban sus ganancias.
          {'\n\n'}
          <Bold>2.5 Datos del dispositivo:</Bold> Modelo del dispositivo, sistema 
          operativo, identificadores únicos y datos de diagnóstico para mejorar el servicio.
        </Section>

        <Section title="3. Cómo Usamos tu Información">
          Utilizamos tu información para:
          {'\n\n'}
          • Procesar y gestionar solicitudes de viaje
          {'\n'}• Conectar pasajeros con conductores disponibles
          {'\n'}• Calcular tarifas y procesar pagos
          {'\n'}• Mostrar el mapa con rutas y ubicaciones en tiempo real
          {'\n'}• Enviar notificaciones sobre el estado del viaje
          {'\n'}• Verificar la identidad y documentos de los conductores
          {'\n'}• Mejorar la seguridad de todos los usuarios
          {'\n'}• Cumplir con obligaciones legales
          {'\n'}• Enviar comunicaciones de servicio y soporte
        </Section>

        <Section title="4. Compartición de Datos">
          <Bold>4.1 Entre usuarios:</Bold> Durante un viaje activo, compartimos:
          {'\n'}• Pasajero → Conductor: nombre, foto de perfil y ubicación de recogida
          {'\n'}• Conductor → Pasajero: nombre, foto, calificación, datos del vehículo 
          y ubicación en tiempo real
          {'\n\n'}
          <Bold>4.2 Con terceros:</Bold> No vendemos tu información personal. Solo 
          compartimos datos cuando es necesario para:
          {'\n'}• Procesadores de pago (datos de transacción)
          {'\n'}• Servicios de mapas y navegación (coordenadas GPS)
          {'\n'}• Autoridades legales (cuando la ley lo requiera)
          {'\n\n'}
          <Bold>Nota sobre verificación de Pago Móvil y transferencias:</Bold> 
          Actualmente, tanto la verificación de pagos por Pago Móvil como 
          las transferencias bancarias a conductores operan en modo de 
          simulación (mock) para pruebas de flujo. Toda la experiencia del 
          usuario funciona igual que en la versión final, pero la conexión 
          real con el Banco Venezolano de Crédito (BVC) se activará cuando 
          el banco apruebe las credenciales de producción para la versión 
          final del servicio.
        </Section>

        <Section title="5. Almacenamiento y Seguridad">
          Tus datos se almacenan en servidores seguros con encriptación. Implementamos 
          medidas técnicas y organizativas para proteger tu información contra acceso no 
          autorizado, alteración, divulgación o destrucción.
          {'\n\n'}
          Las contraseñas se almacenan encriptadas (hash). Los datos de pago sensible 
          se transmiten mediante conexiones seguras (HTTPS/TLS).
        </Section>

        <Section title="6. Retención de Datos">
          Conservamos tu información personal mientras tu cuenta esté activa y durante 
          un período adicional razonable para:
          {'\n\n'}
          • Cumplir con obligaciones legales y fiscales
          {'\n'}• Resolver disputas
          {'\n'}• Hacer cumplir nuestros términos
          {'\n\n'}
          Los datos de ubicación de viajes completados se anonimizan después de 90 días.
        </Section>

        <Section title="7. Tus Derechos">
          Como usuario de UrbanTaxi, tienes derecho a:
          {'\n\n'}
          • <Bold>Acceder</Bold> a tus datos personales que almacenamos
          {'\n'}• <Bold>Rectificar</Bold> información inexacta o incompleta
          {'\n'}• <Bold>Eliminar</Bold> tu cuenta y datos asociados (opción disponible 
          en tu perfil)
          {'\n'}• <Bold>Exportar</Bold> tus datos en un formato portable
          {'\n'}• <Bold>Oponerte</Bold> al procesamiento de tus datos
          {'\n\n'}
          Para ejercer estos derechos, contáctanos a través de los canales indicados 
          en la sección de Contacto.
        </Section>

        <Section title="8. Eliminación de Cuenta">
          Puedes eliminar tu cuenta y todos tus datos asociados en cualquier momento 
          desde la sección "Cuenta" en tu perfil de usuario. El proceso requiere una 
          doble confirmación para evitar eliminaciones accidentales.
          {'\n\n'}
          Al eliminar tu cuenta:
          {'\n'}• Se eliminarán permanentemente tus datos personales
          {'\n'}• Los registros de viajes se anonimizarán
          {'\n'}• Los datos de transacciones se conservarán por obligaciones fiscales
        </Section>

        <Section title="9. Permisos del Dispositivo">
          La aplicación solicita los siguientes permisos:
          {'\n\n'}
          <Bold>Ubicación (en uso y en segundo plano):</Bold> Necesario para mostrar 
          tu posición en el mapa, conectar con conductores cercanos y compartir tu 
          ubicación durante el viaje. Los conductores necesitan ubicación en segundo 
          plano para seguir compartiendo su posición cuando la app está minimizada.
          {'\n\n'}
          <Bold>Notificaciones Push:</Bold> Para informarte sobre el estado de tus 
          viajes, solicitudes de conductor y mensajes importantes.
          {'\n\n'}
          <Bold>Cámara y Galería:</Bold> Opcional, solo para agregar foto de perfil 
          y cargar documentos de verificación (conductores).
        </Section>

        <Section title="10. Menores de Edad">
          UrbanTaxi no está dirigido a menores de 18 años. No recopilamos 
          intencionadamente información de menores. Si descubres que un menor ha 
          proporcionado datos personales, contáctanos para eliminarlos.
        </Section>

        <Section title="11. Cambios a esta Política">
          Podemos actualizar esta Política de Privacidad periódicamente. Te 
          notificaremos sobre cambios significativos a través de la aplicación o 
          por correo electrónico. El uso continuado de la aplicación después de 
          los cambios constituye tu aceptación de la política actualizada.
        </Section>

        <Section title="12. Contacto">
          Si tienes preguntas sobre esta Política de Privacidad o deseas ejercer 
          tus derechos de protección de datos, contáctanos:
          {'\n\n'}
          📧 <Bold>Email:</Bold> urbantaxisapp@gmail.com
          {'\n'}
          🌐 <Bold>Sitio Web:</Bold> https://administracionurbantaxis.com/privacidad
          {'\n'}
          📍 <Bold>Dirección:</Bold> Venezuela
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2026 UrbanTaxi. Todos los derechos reservados.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{children}</Text>
    </View>
  );
}

function Bold({ children }: { children: string }) {
  return <Text style={{ fontWeight: '700', color: '#111827' }}>{children}</Text>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  lastUpdated: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 10,
  },
  sectionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  footer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
