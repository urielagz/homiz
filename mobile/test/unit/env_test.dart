import 'package:flutter_test/flutter_test.dart';
import 'package:homiz/core/utils/env.dart';

void main() {
  test('la app web busca la API en el puerto 3000 del mismo servidor', () {
    expect(Env.apiFor(Uri.parse('http://localhost:5600/')), 'http://localhost:3000/api/v1');
    expect(Env.apiFor(Uri.parse('http://192.168.1.68:5600/#/home')), 'http://192.168.1.68:3000/api/v1');
  });

  test('con un puerto reenviado de VS Code usa el túnel del puerto 3000', () {
    expect(Env.apiFor(Uri.parse('https://k8f2x9-5600.usw2.devtunnels.ms/')), 'https://k8f2x9-3000.usw2.devtunnels.ms/api/v1');
  });
}
