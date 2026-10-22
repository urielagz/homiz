import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Conversaciones de WhatsApp con el mensaje ya escrito (igual que los botones del sitio web).
abstract final class WhatsApp {
  /// Número de Zugar: el mismo del sitio (web/assets/js/main.js, constante WHATSAPP).
  static const zugar = '529985550142';

  /// Enlace wa.me. Sin [phone] escribe a Zugar; un número de 10 dígitos se toma como de México (+52).
  static Uri link(String text, {String? phone}) {
    var digits = (phone ?? zugar).replaceAll(RegExp(r'\D'), '');
    if (digits.length == 10) digits = '52$digits';
    return Uri.parse('https://wa.me/$digits?text=${Uri.encodeComponent(text)}');
  }

  static Future<void> open(BuildContext context, String text, {String? phone}) async {
    final messenger = ScaffoldMessenger.of(context);
    final ok = await launchUrl(link(text, phone: phone), mode: LaunchMode.externalApplication);
    if (!ok) messenger.showSnackBar(const SnackBar(content: Text('No pudimos abrir WhatsApp en este dispositivo.')));
  }
}

/// Botón «Prefiero WhatsApp» / «Escribir por WhatsApp» en forma de píldora con contorno verde.
class WhatsAppButton extends StatelessWidget {
  const WhatsAppButton({super.key, required this.message, this.phone, this.label = 'Prefiero WhatsApp'});

  final String message;
  final String? phone;
  final String label;

  static const color = Color(0xFF1FA855); // verde de WhatsApp con contraste suficiente sobre blanco

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: OutlinedButton.icon(
        style: OutlinedButton.styleFrom(
          foregroundColor: color,
          side: const BorderSide(color: color, width: 1.5),
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
        ),
        onPressed: () => WhatsApp.open(context, message, phone: phone),
        icon: const Icon(Icons.chat_outlined, size: 20),
        label: Text(label),
      ),
    );
  }
}
