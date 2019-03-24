# ng-storybook-schematics

This project aims to speed up the creation of stories for components to use with [@storybook](https://storybook.js.org/)
for Angular. Therefore it provides a schematic to use with the Angular CLI. With that you can easily create a component 
that mirrors the inputs and outputs of your components you want to create stories for and creates a stories.ts file
to expand on.

## How to use it

In order to use this schematic you first need to install it with `npm i ng-storybook-schematics`

Then you can use it in the folder of a angular component with the command
`ng generate ng-storybook-schematics:story` to create the story component and stories file.

