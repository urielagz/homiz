import 'package:flutter_test/flutter_test.dart';
import 'package:homiz/core/utils/whatsapp.dart';

void main() {
  test('sin número escribe a Zugar (el mismo número del sitio)', () {
    final uri = WhatsApp.link('Hola, me interesa Casa Ceiba en Arbolada.');
    expect(uri.host, 'wa.me');
    expect(uri.path, '/529985550142');
    expect(uri.queryParameters['text'], 'Hola, me interesa Casa Ceiba en Arbolada.');
  });

  test('un teléfono de 10 dígitos se toma como de México', () {
    expect(WhatsApp.link('Hola', phone: '998 555 0128').path, '/529985550128');
    expect(WhatsApp.link('Hola', phone: '+52 998 555 0201').path, '/529985550201');
  });
}
