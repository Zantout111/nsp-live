import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiClient {
  final String baseUrl;
  final http.Client _http;

  ApiClient({
    required this.baseUrl,
    http.Client? httpClient,
  }) : _http = httpClient ?? http.Client();

  Uri _uriFromBase(String base, String path) => Uri.parse('$base$path');

  List<String> _fallbackBases() {
    final out = <String>[];
    if (baseUrl.contains('10.0.2.2')) {
      out.add(baseUrl.replaceFirst('10.0.2.2', 'localhost'));
      out.add(baseUrl.replaceFirst('10.0.2.2', '127.0.0.1'));
    } else if (baseUrl.contains('localhost')) {
      out.add(baseUrl.replaceFirst('localhost', '127.0.0.1'));
    }
    return out;
  }

  Future<Map<String, dynamic>> getJson(String path) async {
    Object? lastError;
    final candidates = <String>[baseUrl, ..._fallbackBases()];

    for (final base in candidates) {
      try {
        final res = await _http.get(_uriFromBase(base, path), headers: {'Accept': 'application/json'});
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return jsonDecode(res.body) as Map<String, dynamic>;
        }
        lastError = Exception('GET $path failed: ${res.statusCode}');
      } catch (e) {
        lastError = e;
      }
    }
    throw Exception(
      'Network fetch failed for $path. Tried: ${candidates.join(', ')}. Last error: $lastError',
    );
  }

  void close() => _http.close();
}
