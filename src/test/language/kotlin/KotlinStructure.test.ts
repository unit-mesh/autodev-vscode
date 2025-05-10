import { TestLanguageServiceProvider } from "src/test/TestLanguageService";
import { KotlinStructurerProvider } from "../../../code-context/kotlin/KotlinStructurerProvider";

const Parser = require('web-tree-sitter');

describe('KotlinStructure', () => {
	it('should convert a simple file to CodeFile', async () => {
		const kotlinHelloWorld = `package com.example
interface Shape {
    val vertexCount: Int
}

class Rectangle(override val vertexCount: Int = 4) : Shape // Always has 4 vertices

class Polygon : Shape {
    override var vertexCount: Int = 0  // Can be set to any number later
}`;

		await Parser.init();
		const parser = new Parser();
		const languageService = new TestLanguageServiceProvider(parser);

		const structurer = new KotlinStructurerProvider();
		await structurer.init(languageService);

		const codeFile = await structurer.parseFile(kotlinHelloWorld, '');
		console.log(codeFile);
	});
});
