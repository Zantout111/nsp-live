export type DocSnippet = { id: string; label: string; language: string; code: string };

export function buildRateApiDocSnippets(baseUrl: string): DocSnippet[] {
  const u = baseUrl.replace(/\/$/, '');
  const endpoint = `${u}/api/rates`;

  return [
    {
      id: 'curl',
      label: 'cURL',
      language: 'bash',
      code: `curl -sS "${endpoint}" \\
  -H "Accept: application/json"`,
    },
    {
      id: 'js',
      label: 'JavaScript',
      language: 'javascript',
      code: `const res = await fetch("${endpoint}", {
  headers: { Accept: "application/json" },
});
const json = await res.json();
console.log(json.success, json.data?.rates?.length);`,
    },
    {
      id: 'ts',
      label: 'TypeScript',
      language: 'typescript',
      code: `type RatesResponse = {
  success: boolean;
  data?: { rates: unknown[]; goldPrice?: unknown };
};

const res = await fetch("${endpoint}", {
  headers: { Accept: "application/json" },
});
const json = (await res.json()) as RatesResponse;
if (!json.success) throw new Error("Rates request failed");`,
    },
    {
      id: 'react',
      label: 'React',
      language: 'tsx',
      code: `'use client';

import { useEffect, useState } from 'react';

export function RatesWidget() {
  const [data, setData] = useState<unknown>(null);

  useEffect(() => {
    fetch("${endpoint}")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}`,
    },
    {
      id: 'python',
      label: 'Python',
      language: 'python',
      code: `import urllib.request
import json

req = urllib.request.Request(
    "${endpoint}",
    headers={"Accept": "application/json"},
)
with urllib.request.urlopen(req, timeout=30) as resp:
    data = json.load(resp)
print(data.get("success"), len(data.get("data", {}).get("rates", [])))`,
    },
    {
      id: 'php',
      label: 'PHP',
      language: 'php',
      code: `<?php
$ch = curl_init("${endpoint}");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Accept: application/json'],
]);
$body = curl_exec($ch);
curl_close($ch);
$data = json_decode($body, true);
var_dump($data['success'] ?? null);`,
    },
    {
      id: 'csharp',
      label: 'C#',
      language: 'csharp',
      code: `using var client = new HttpClient();
client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
var json = await client.GetStringAsync("${endpoint}");
Console.WriteLine(json.Length);`,
    },
    {
      id: 'java',
      label: 'Java',
      language: 'java',
      code: `import java.net.URI;
import java.net.http.*;

var client = HttpClient.newHttpClient();
var req = HttpRequest.newBuilder()
    .uri(URI.create("${endpoint}"))
    .header("Accept", "application/json")
    .GET()
    .build();
var res = client.send(req, HttpResponse.BodyHandlers.ofString());
System.out.println(res.body().length());`,
    },
    {
      id: 'go',
      label: 'Go',
      language: 'go',
      code: `package main

import (
  "encoding/json"
  "io"
  "net/http"
)

func main() {
  res, err := http.Get("${endpoint}")
  if err != nil { panic(err) }
  defer res.Body.Close()
  body, _ := io.ReadAll(res.Body)
  var out map[string]any
  _ = json.Unmarshal(body, &out)
}`,
    },
    {
      id: 'ruby',
      label: 'Ruby',
      language: 'ruby',
      code: `require "net/http"
require "json"

uri = URI("${endpoint}")
res = Net::HTTP.get_response(uri)
data = JSON.parse(res.body)
puts data["success"]`,
    },
    {
      id: 'rust',
      label: 'Rust',
      language: 'rust',
      code: `// Cargo: reqwest = { version = "0.12", features = ["blocking", "json"] }, serde_json = "1"

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let body = reqwest::blocking::get("${endpoint}")?.text()?;
    let v: serde_json::Value = serde_json::from_str(&body)?;
    println!("{:?}", v.get("success"));
    Ok(())
}`,
    },
    {
      id: 'kotlin',
      label: 'Kotlin',
      language: 'kotlin',
      code: `import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse.BodyHandlers

fun main() {
    val client = HttpClient.newHttpClient()
    val req = HttpRequest.newBuilder()
        .uri(URI.create("${endpoint}"))
        .header("Accept", "application/json")
        .GET()
        .build()
    val res = client.send(req, BodyHandlers.ofString())
    println(res.body().length)
}`,
    },
    {
      id: 'swift',
      label: 'Swift',
      language: 'swift',
      code: `import Foundation

let url = URL(string: "${endpoint}")!
var req = URLRequest(url: url)
req.setValue("application/json", forHTTPHeaderField: "Accept")

URLSession.shared.dataTask(with: req) { data, _, _ in
    print(String(data: data ?? Data(), encoding: .utf8) ?? "")
}.resume()`,
    },
    {
      id: 'dart',
      label: 'Dart',
      language: 'dart',
      code: `import 'dart:convert';
import 'package:http/http.dart' as http;

Future<void> main() async {
  final res = await http.get(
    Uri.parse('${endpoint}'),
    headers: {'Accept': 'application/json'},
  );
  print(jsonDecode(res.body)['success']);
}`,
    },
  ];
}
