import {
	apply,
	applyTemplates,
	chain,
	externalSchematic,
	mergeWith,
	move,
	Rule,
	SchematicContext,
	SchematicsException,
	Tree,
	url
} from '@angular-devkit/schematics';
import {normalize, strings} from '@angular-devkit/core';
import {dasherize} from '@angular-devkit/core/src/utils/strings';
import {getProject} from '@schematics/angular/utility/project';
import {Fields} from '../interfaces/fields';
import forEach from 'lodash/forEach';
import isEmpty from 'lodash/isEmpty';
import {
	createImportStatements,
	extractFieldName,
	getFieldTypes,
	getTypesToImport,
	prepareOptions
} from '../utilities/utilities';

let inputs: Fields = {};
let outputs: Fields = {};
let importStatements: string;
let selector: string;
let isHostBindingNeeded = false;

export default function (options: any): Rule {
	options = prepareOptions(options);
	selector = dasherize(options.name);

	return chain([
		extractInformation(options),
		createStories(options),
		externalSchematic('@schematics/angular', 'component', {
			...options,
			name: options.storyName,
			path: options.storyPath
		}),
		updateStoryComponent(options)
	]);

}

function extractInformation(options: any): Rule {
	return (tree: Tree, _context) => {
		if (!options.project) throw new SchematicsException('Option (project) is required.');
		const project = getProject(tree, options.project);
		options.style = project.schematics ? project.schematics['@schematics/angular:component'].style : 'css';

		if (project.prefix) {
			options.prefix = project.prefix;
		}

		const component = tree.read(normalize(options.path + '/' + options.name + '.component.ts'));
		if (!component) throw new SchematicsException(`Could not find a ${options.name}.component.ts.`);

		const content = component.toString();
		const matcher = '\\((.*)\\)\\n*((.*)\\n*)(@.*\\n)*(.*);';

		let inputMatches = content.match(new RegExp('@Input' + matcher, 'g'));
		let outputMatches = content.match(new RegExp('@Output' + matcher, 'g'));

		if (!inputMatches) inputMatches = [];
		if (!outputMatches) outputMatches = [];

		forEach(inputMatches, match => {
			const {types, typeToDisplay} = getFieldTypes(match);
			if (match.includes('@HostBinding')) {
				isHostBindingNeeded = true;
			}
			inputs[extractFieldName(match)] = {field: match, types, typeToDisplay};
		});
		forEach(outputMatches, match => {
			const {types, typeToDisplay} = getFieldTypes(match);
			outputs[extractFieldName(match)] = {field: match, types, typeToDisplay};
		});

		importStatements = createImportStatements(
			content.match(/import.*/gm),
			getTypesToImport({...inputs, ...outputs}),
			options.flat
		);
		return tree;
	}
}

function createStories(options: any): Rule {
	return (tree: Tree, _context) => {
		const isStoryActionNeeded = !isEmpty(outputs);
		const templateSource = apply(url('./files'), [
			applyTemplates({
				...strings,
				insertDefaultProps,
				...options,
				isStoryActionNeeded,
				path: options.storyPath,
			}),
			move(options.storyPath)
		]);
		const rule = mergeWith(templateSource);
		return rule(tree, _context);
	}
}


function updateStoryComponent(options: any): Rule {
	return (tree: Tree, _context: SchematicContext) => {
		const baseFilePath = normalize(options.storyPath + (options.flat ? '' : '/' + options.storyName) + `/${options.storyName}.component`);
		const sourceComponent = tree.read(baseFilePath + '.ts');
		
		if (!sourceComponent) throw new SchematicsException(`Could not find a ${options.storyName}.component.ts.`);

		let sourceComponentContent = sourceComponent.toString();
		const entryPointMatch = sourceComponentContent.match(/export class.*{/);
		if (!entryPointMatch || !entryPointMatch.index) throw new SchematicsException('Component does not export class. Could not find entry point.');
		const entryPoint = entryPointMatch.index + entryPointMatch[0].length;

		if (options.prefix) {
			selector = `${options.prefix}-${selector}`;
		}
		const inlineTemplateMatcher = /`(\n\s*.*)*`/;
		let fieldBlock = '\n';

		let templateBlock = '';
		forEach(outputs, (value, key) => {
			fieldBlock += (value.field + '\n');
			templateBlock += `(${key})="${key}.emit($event)"\n`;
		});
		forEach(inputs, (value, key) => {
			fieldBlock += (value.field + '\n');
			templateBlock += `[${key}]="${key}"\n`;
		});
		let componentContent = sourceComponentContent.slice(0, entryPoint) + fieldBlock + sourceComponentContent.slice(entryPoint + 1);
		const templateContent = `<${selector} ${templateBlock}></${selector}>`;
		const coreImportsEntryPoint = componentContent.indexOf('{') + 2;
		componentContent = componentContent.slice(0, coreImportsEntryPoint)
			+ (isEmpty(inputs) ? '' : 'Input, ')
			+ (isHostBindingNeeded ? 'HostBinding, ' : '')
			+ (isEmpty(outputs) ? '' : 'Output, EventEmitter, ')
			+ componentContent.slice(coreImportsEntryPoint);
		componentContent = importStatements + componentContent;
		if (options.inlineStory) {
			tree.overwrite(
				baseFilePath + '.ts',
				componentContent.replace(inlineTemplateMatcher, `\`${templateContent}\``)
			);
		} else {
			tree.overwrite(baseFilePath + '.html', templateContent);
			tree.overwrite(baseFilePath + '.ts', componentContent);
		}

		return tree;
	};
}


function insertDefaultProps() {
	let defaultProps = '';
	forEach(inputs, (value, key) => {
		const defaultValue = 'please insert value' + (value.typeToDisplay === '' ? '' : ` of type: ${value.typeToDisplay}`);
		defaultProps += key + `: \`${defaultValue}\`,\n`;
	});
	forEach(outputs, (value, key) => {
		defaultProps += key + `: action('${key}'),\n`;
	});
	return defaultProps.slice(0, -2);
}
