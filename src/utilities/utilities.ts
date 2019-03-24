import {Fields} from '../interfaces/fields';
import forEach from 'lodash/forEach';
import {basename} from '@angular-devkit/core';
import {parseName} from '@schematics/angular/utility/parse-name';
import {dasherize} from '@angular-devkit/core/src/utils/strings';

export function getTypesToImport(fields: Fields): string[] {
	const simpleTypes = ['string', 'boolean', 'number', 'any'];
	let types: string[] = [];
	forEach(fields, (value) => {
		const type = value.types;
		if (type.length === 0) return;
		if (type.length === 1) {
			types.push(type[0]);
			return;
		}
		forEach(type, value => {
			types.push(value);
		});
	});
	return types.filter((value, index, array) => array.indexOf(value) === index && simpleTypes.indexOf(value) === -1);
}

export function getFieldTypes(string: string): { types: string[], typeToDisplay: string } {
	let typeToDisplay = '';
	let types: string[] = [];
	const matches = string.match(/(<.*>)|: .*;/g);
	if (!matches) return {types, typeToDisplay};
	let typeSource = matches[0].replace(/[\s:=\[\];]/g, '');
	if (typeSource.startsWith('<')) {
		typeToDisplay = typeSource.slice(1, -1);
		types.push(typeToDisplay);
	}
	if (typeSource.includes('<', 1)) {
		typeToDisplay = typeSource;
		types = typeSource.replace('<', ';').replace('>', '').split(';');
		return {typeToDisplay, types};
	}
	types.push(typeSource);
	return {typeToDisplay: typeSource, types: types};
}

export function createImportStatements(matches: RegExpMatchArray | null, typesToImport: string[], isFlat: boolean): string {
	if (!matches) return '';
	let result: string[] = [];

	forEach(typesToImport, type => {
		forEach(matches, match => {
			if (match.indexOf(type) !== -1) {
				const replacer = isFlat ? '\'../..' : '\'../../..';
				const newImport = match.replace('\'..', replacer);
				if (result.indexOf(newImport) === -1) {
					result.push(newImport);
				}
			}
		})
	});
	let importStatements = '';
	forEach(result, importStatement => {
		importStatements += `${importStatement}\n`;
	});
	return importStatements;

}

export function extractFieldName(match: string): string {
	const result = match.match(/((\S*)(:| =))/);
	if (!result) return '';
	return result[0].replace(/[\s:=]/g, '');
}

export function prepareOptions(_options: any) {
	let options: any = {};
	options.inlineStyle = _options.inlineStory;
	options.inlineTemplate = _options.inlineStory;
	options.flat = _options.inlineStory;
	options.skipTests = true;
	options.skipImport = !_options.module;

	options.storyPath = _options.path;
	options.name = basename(_options.path);
	if (!_options.storyName) {
		const parsedName = parseName(_options.path, 'stories/' + options.name);
		options.storyName = 'stories-' + dasherize(parsedName.name);
		options.storyPath = parsedName.path;
	}

	return {..._options, ...options};
}
