import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme/app_spacing.dart';
import '../utils/whatsapp.dart';

/// Botones «Llamar», «WhatsApp» y «Correo» (abren el marcador, WhatsApp y la app de correo del teléfono).
class ContactActions extends StatelessWidget {
  const ContactActions({super.key, this.phone, this.email, this.subject, this.whatsappText});

  final String? phone;
  final String? email;
  final String? subject;

  /// Mensaje ya escrito para WhatsApp (por omisión, un saludo de Zugar).
  final String? whatsappText;

  static Future<void> _open(BuildContext context, Uri uri) async {
    final messenger = ScaffoldMessenger.of(context);
    if (!await launchUrl(uri)) {
      messenger.showSnackBar(const SnackBar(content: Text('No encontramos una aplicación para abrirlo en este dispositivo.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasPhone = phone != null && phone!.trim().isNotEmpty;
    final hasEmail = email != null && email!.trim().isNotEmpty;
    if (!hasPhone && !hasEmail) return const SizedBox.shrink();
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        if (hasPhone)
          OutlinedButton.icon(
            onPressed: () => _open(context, Uri(scheme: 'tel', path: phone!.replaceAll(RegExp(r'[^\d+]'), ''))),
            icon: const Icon(Icons.call_outlined, size: 18),
            label: const Text('Llamar'),
          ),
        if (hasPhone)
          OutlinedButton.icon(
            onPressed: () => WhatsApp.open(context, whatsappText ?? 'Hola, te escribimos de Zugar Inmobiliaria.', phone: phone),
            icon: const Icon(Icons.chat_outlined, size: 18),
            label: const Text('WhatsApp'),
          ),
        if (hasEmail)
          OutlinedButton.icon(
            onPressed: () => _open(context, Uri(scheme: 'mailto', path: email, query: subject == null ? null : 'subject=${Uri.encodeComponent(subject!)}')),
            icon: const Icon(Icons.mail_outline_rounded, size: 18),
            label: const Text('Correo'),
          ),
      ],
    );
  }
}
