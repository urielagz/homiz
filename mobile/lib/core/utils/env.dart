/// Configuración por ambiente: flutter run --dart-define=API_URL=https://api.zugar.mx/api/v1
/// En el emulador de Android, «localhost» de la computadora es 10.0.2.2.
abstract final class Env {
  static const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:3000/api/v1');
}
