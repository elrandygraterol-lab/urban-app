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

export default function TermsOfServiceScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Términos de Servicio</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Última actualización: 20 de junio de 2026</Text>

        <Section title="1. Aceptación de los Términos">
          Al descargar, instalar o utilizar la aplicación UrbanTaxi SJ ("la Aplicación"), 
          aceptas estar sujeto a estos Términos de Servicio ("Términos"). Si no estás 
          de acuerdo con estos Términos, no debes utilizar la Aplicación.
          {'\n\n'}
          UrbanTaxi SJ es una plataforma tecnológica que conecta a pasajeros que solicitan 
          servicios de transporte con conductores independientes que ofrecen dichos 
          servicios. UrbanTaxi SJ NO es una empresa de transporte y no emplea conductores.
        </Section>

        <Section title="2. Elegibilidad">
          Para utilizar la Aplicación como pasajero debes ser mayor de 18 años. Para 
          registrarte como conductor debes:
          {'\n\n'}
          • Ser mayor de 18 años
          {'\n'}• Poseer licencia de conducir vigente
          {'\n'}• Tener un vehículo en condiciones adecuadas
          {'\n'}• Proporcionar documentación verídica (licencia, certificado médico, 
          datos del vehículo)
          {'\n'}• Aprobar el proceso de verificación de la plataforma
        </Section>

        <Section title="3. Cuenta de Usuario">
          Eres responsable de mantener la confidencialidad de tu cuenta y contraseña. 
          Debes proporcionar información precisa, actualizada y completa durante el 
          registro. No debes compartir tu cuenta con terceros ni usar la cuenta de 
          otra persona.
        </Section>

        <Section title="4. Servicios de la Plataforma">
          <Bold>4.1 Para Pasajeros:</Bold> La Aplicación te permite solicitar servicios 
          de transporte ingresando tu punto de recogida y destino, ver la tarifa estimada 
          antes de confirmar, seguir en tiempo real la ubicación de tu conductor una vez 
          que acepta el viaje, y calificar al conductor al finalizar.
          {'\n\n'}
          <Bold>4.2 Para Conductores:</Bold> La Aplicación te permite recibir solicitudes 
          de viaje, navegar hacia puntos de recogida y destino, gestionar tu 
          disponibilidad, y recibir pagos por tus servicios.
          {'\n\n'}
          <Bold>4.3 Tarifas:</Bold> Las tarifas se calculan mediante un motor de 
          tarifas por zonas que considera el tipo de tarifa configurado para cada ruta:
          {'\n\n'}
          • <Bold>Tarifa por Zona:</Bold> Precio fijo para viajes dentro de una zona 
          o entre zonas específicas.
          {'\n'}• <Bold>Tarifa por Kilómetro:</Bold> Tarifa base + costo por kilómetro 
          recorrido según la distancia estimada de la ruta.
          {'\n'}• <Bold>Tarifa por Hora:</Bold> Tarifa base + costo por hora según la 
          duración estimada del viaje.
          {'\n\n'}
          El sistema selecciona automáticamente la tarifa aplicable según las zonas de 
          recogida y destino. Pueden aplicarse recargos por horario nocturno o 
          condiciones especiales configuradas por la plataforma. La tarifa estimada 
          se muestra antes de confirmar el viaje.
        </Section>

        <Section title="5. Pagos">
          <Bold>5.1 Pasajeros:</Bold> Puedes pagar en efectivo directamente al conductor 
          o mediante Pago Móvil. El pago debe realizarse según lo acordado antes de 
          iniciar el viaje.
          {'\n\n'}
          <Bold>5.2 Simulación de verificación:</Bold> Tanto la verificación de 
          pagos por Pago Móvil como las transferencias bancarias a conductores 
          se encuentran actualmente en modo de simulación (mock) para pruebas 
          de flujo. La integración real con el Banco Venezolano de Crédito (BVC) 
          se activará en la versión final del servicio.
          {'\n\n'}
          <Bold>5.3 Conductores:</Bold> Recibirás tus ganancias a través de Pago Móvil 
          o transferencia bancaria según los datos que proporciones en tu perfil. El 
          administrador del sistema procesará los pagos de forma semanal o mensual, 
          según lo definido en la contratación y los acuerdos establecidos. Las 
          ganancias están sujetas a la comisión de la plataforma.
        </Section>

        <Section title="6. Conducta del Usuario">
          Todos los usuarios se comprometen a:
          {'\n\n'}
          • Tratar a los demás con respeto y cortesía
          {'\n'}• No discriminar por raza, género, religión u orientación
          {'\n'}• No dañar la propiedad ajena
          {'\n'}• No usar la plataforma para actividades ilegales
          {'\n'}• No manipular el sistema de tarifas o calificaciones
          {'\n'}• Reportar cualquier incidente o comportamiento inapropiado
          {'\n\n'}
          UrbanTaxi SJ se reserva el derecho de suspender o cancelar cuentas que violen 
          estas normas de conducta.
        </Section>

        <Section title="7. Cancelaciones">
          <Bold>7.1 Período de Gracia:</Bold> Las cancelaciones realizadas dentro de 
          los primeros 2 minutos después de solicitar el viaje son gratuitas y no 
          generan ningún cargo.
          {'\n\n'}
          <Bold>7.2 Cancelación por el Pasajero:</Bold>
          {'\n'}• Si el viaje está en estado <Bold>"pendiente"</Bold> (sin conductor 
          asignado): cancelación gratuita en cualquier momento.
          {'\n'}• Si el viaje está en estado <Bold>"aceptado"</Bold> (conductor 
          asignado) después del período de gracia: se aplica un cargo por cancelación 
          equivalente a un porcentaje de la tarifa estimada o una tarifa estándar 
          (Bs. 5,00), lo que resulte aplicable según la configuración vigente.
          {'\n'}• Si el conductor ya <Bold>"llegó"</Bold> al punto de recogida: se 
          aplica una penalidad del 50% de la tarifa estimada. El pasajero recibe un 
          reembolso del 50% en un plazo de 24 horas.
          {'\n\n'}
          <Bold>7.3 Cancelación por el Conductor:</Bold> El conductor puede cancelar 
          un viaje en estado "aceptado" sin costo. Si el conductor cancela, el sistema 
          genera automáticamente una nueva solicitud para el pasajero.
          {'\n\n'}
          <Bold>7.4 Viajes en Progreso:</Bold> No se permiten cancelaciones una vez 
          que el viaje ha iniciado (estado "en progreso").
          {'\n\n'}
          <Bold>7.5 Cancelación por Tiempo de Espera:</Bold> Si ningún conductor 
          acepta el viaje en un plazo de 60 segundos, el sistema cancela 
          automáticamente la solicitud sin costo para el pasajero.
        </Section>

        <Section title="8. Limitación de Responsabilidad">
          UrbanTaxi SJ actúa como plataforma de conexión entre pasajeros y conductores 
          independientes. No somos responsables de:
          {'\n\n'}
          • La conducta de pasajeros o conductores
          {'\n'}• La calidad del servicio de transporte
          {'\n'}• Daños, pérdidas o lesiones durante el viaje
          {'\n'}• Problemas técnicos fuera de nuestro control
          {'\n'}• Retrasos o cancelaciones inevitables
          {'\n\n'}
          Nuestra responsabilidad se limita al monto pagado por el servicio de 
          plataforma (comisión), en la medida permitida por la ley.
        </Section>

        <Section title="9. Propiedad Intelectual">
          La Aplicación, su diseño, código fuente, marca, logotipo y contenido son 
          propiedad de UrbanTaxi SJ. No puedes copiar, modificar, distribuir o crear 
          obras derivadas sin autorización expresa.
        </Section>

        <Section title="10. Terminación">
          Puedes dejar de usar la Aplicación en cualquier momento. UrbanTaxi SJ puede 
          suspender o cerrar tu cuenta si violas estos Términos, con o sin previo 
          aviso. La eliminación de cuenta eliminará tus datos personales según 
          nuestra Política de Privacidad.
        </Section>

        <Section title="11. Modificaciones">
          Podemos modificar estos Términos en cualquier momento. Los cambios 
          significativos se notificarán a través de la Aplicación. El uso continuado 
          después de las modificaciones constituye tu aceptación de los nuevos términos.
        </Section>

        <Section title="12. Ley Aplicable">
          Estos Términos se rigen por las leyes de la República Bolivariana de 
          Venezuela. Cualquier disputa se resolverá en los tribunales competentes 
          de Caracas, Venezuela.
        </Section>

        <Section title="13. Contacto">
          Para consultas sobre estos Términos:
          {'\n\n'}
          📧 <Bold>Email:</Bold> urbantaxisapp@gmail.com
          {'\n'}
          🌐 <Bold>Sitio Web:</Bold> https://administracionurbantaxis.com/terminos
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2026 UrbanTaxi SJ. Todos los derechos reservados.
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
