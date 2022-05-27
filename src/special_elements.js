import React from "react";
import {Tooltip} from "./generic_elements";
import {translateIEItem, upperCaseName} from "./localization";
import {getAssetPath, getIconPath, getRecipePath, getTagPath, MOD_ID} from "./resources";

const SPECIAL_ELEMENT_HEIGHTS = {
    crafting: (e) => 'recipe' in e ? 7 : 'recipes' in e ? 7 * e['recipes'].length : 1,
    item_display: () => 4,
    image: (e) => 'images' in e ? e['images'].reduce((acc, image) => {
        let scale = 55 / image['uSize'];
        return acc + image['vSize'] * scale * 0.25;
    }, 0) : 1,
    blueprint: () => 7,
    multiblock: () => 5,
};

export function loadSpecialElement(branch, element) {
    // normal recipes
    if (element['type'] === 'crafting') {
        //single recipe
        if (element['recipe'])
            return Recipe.loadRecipe(branch, element['recipe']);
        //multiple recipes
        else if (element['recipes']) {
            let recipes = element['recipes'];
            return Promise.all(recipes.map(recipe => {
                if (Array.isArray(recipe))
                    return MultiRecipe.parseMultiRecipe(branch, recipe);
                else
                    return Recipe.loadRecipe(branch, recipe);
            }));
        }
    }
    // item displays look very silly without textures
    if (element['type'] === 'item_display') {
        return Promise.resolve(element['item'] ? [element['item']] : element['items'])
            .then(res => Promise.all(res.map(item => PreparedIngredient.of(item, branch))))
            .then(res => res.map(item => <Ingredient symbol={'Item'} value={item}/>))
            .then(res => <div className="item_display">{res}</div>);
    }
    // images
    if (element['type'] === 'image') {
        return Promise.resolve(
            <div className="images">
                {element['images'].map((image, idx) => {
                        let scale = 55 / image['uSize'];
                        let offset = [-scale * image['uMin'], -scale * image['vMin']];
                        let style = {
                            'backgroundImage': `url(${getAssetPath(branch)}${image['location']})`,
                            'height': `${scale * image['vSize']}vmin`,
                            'backgroundSize': `${Math.round(256 / image['uSize'] * 100)}%`,
                            'backgroundPosition': `${offset[0]}vmin ${offset[1]}vmin`
                        }
                        return <div className="embedded_image" key={idx} style={style}/>
                    }
                )}
            </div>);
    }
    // blueprints are just shapeless recipes but easier
    if (element['type'] === 'blueprint') {
        //single recipe
        if (element['recipe'])
            return Blueprint.loadRecipes(branch, [element['recipe']]);
        //multiple recipes
        else if (element['recipes'])
            return Blueprint.loadRecipes(branch, element['recipes']);
    }
    // multiblocks are not rendered
    if (element['type'] === 'multiblock') {
        return Promise.resolve(<div className="multiblock">
            In the ingame manual, you would see a cool looking multiblock here.<br/>
            {element['name']}
        </div>)
    }
    return new Promise((resolve, reject) => resolve(null));
}

export function getSpecialHeight(element) {
    if (!element)
        return 0;
    let type = element['type'] || '';
    if (!(type in SPECIAL_ELEMENT_HEIGHTS))
        return 0;
    return SPECIAL_ELEMENT_HEIGHTS[type](element) || 0;
}

function decomposeResourceLocation(fullName) {
    let split = fullName.split(':');
    let domain = split.length > 1 ? split[0] : MOD_ID;
    let name = split[split.length - 1];
    return {domain: domain, name: name};
}

function ingredientTooltip(ingredient) {
    if (ingredient['tag'])
        return (<>
            <span>Tag:</span><br/>
            <span>{ingredient['tag']}</span>
        </>);
    else if (ingredient['item']) {
        const nameParts = decomposeResourceLocation(ingredient['item']);
        let domain;
        let name;
        if (nameParts.domain === MOD_ID) {
            name = translateIEItem(nameParts.name);
            domain = 'Immersive Engineering';
        } else {
            domain = upperCaseName(nameParts.domain);
            name = upperCaseName(nameParts.name);
        }
        return (<>
            <span>{name}</span><br/>
            <span className="domain formatting_o">{domain}</span>
        </>);
    }
    return '';
}

// TODO cycle through multiple for tags?
function getItemToShow(ingredient, branch) {
    if (ingredient['item']) {
        return decomposeResourceLocation(ingredient['item']);
    } else if (ingredient['tag']) {
        const basePath = getTagPath(branch);
        const tagParts = decomposeResourceLocation(ingredient['tag']);
        return fetch(`${basePath}/${tagParts.domain}/${tagParts.name}.json`)
            .then(res => res.json())
            .then(res => {
                // Prefer IE items: we do not have icons for vanilla items
                for (let itemInTag of res) {
                    if (itemInTag.startsWith(MOD_ID)) {
                        return itemInTag;
                    }
                }
                // Fall back to non-IE item
                return res[0];
            })
            .then(res => decomposeResourceLocation(res))
            .catch(err => undefined);
    }
    return undefined;
}

function unwrapIngredient(ingredient) {
    while (ingredient && ingredient['base_ingredient']) {
        ingredient = ingredient['base_ingredient'];
    }
    return ingredient;
}

class PreparedIngredient {
    rawData;
    itemImage;
    itemToShow;
    tooltip;

    constructor(rawData, itemToShow, itemImage, tooltip) {
        this.rawData = rawData;
        this.itemToShow = itemToShow;
        this.itemImage = itemImage;
        this.tooltip = tooltip;
    }

    static async of(ingredientJson, branch) {
        ingredientJson = unwrapIngredient(ingredientJson);
        if (ingredientJson) {
            const item = await getItemToShow(ingredientJson, branch);
            const itemImage = await imageForItem(item, branch);
            return new PreparedIngredient(ingredientJson, item, itemImage, ingredientTooltip(ingredientJson));
        } else {
            return undefined;
        }
    }
}

class Recipe extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        if (this.props.data['pattern'])
            return Recipe.buildShapedRecipe(this.props.name, this.props.data);
        else if (this.props.data['ingredients'])
            return Recipe.buildShapelessRecipe(this.props.name, this.props.data);
    }

    static loadRecipeFromElement(branch, element) {
        if (typeof element === 'string')
            return Recipe.loadRecipe(branch, element);
        else if (typeof element === 'object' && 'recipe' in element)
            return Recipe.loadRecipe(branch, element['recipe']);
        return null;
    }

    static async loadRecipe(branch, key) {
        let json = await (await fetch(`${getRecipePath(branch)}${key}.json`)).json();
        if ('baseRecipe' in json) {
            json = json['baseRecipe'];
        }
        if ('pattern' in json) {
            let newKey = {};
            for (const key in json.key) {
                newKey[key] = await PreparedIngredient.of(json.key[key], branch);
            }
            json.key = newKey;
        } else if ('ingredients' in json) {
            let newIngredients = [];
            for (const ingredient of json.ingredients) {
                newIngredients.push(await PreparedIngredient.of(ingredient, branch));
            }
            json.ingredients = newIngredients;
        }
        json.result = await PreparedIngredient.of(json.result, branch);
        return <Recipe name={key} key={key} data={json}/>;
    }

    static buildShapedRecipe(name, data) {
        let patternFlat = data.pattern.join('').split('');
        return (
            <div className="recipe" name={name}>
                <div className={'grid col' + data.pattern[0].length}>
                    {patternFlat.map((c, i) => <Ingredient key={i} symbol={c} value={data.key[c]}/>)}
                </div>
                <div className="crafting-arrow"/>
                <div className="output">
                    <Ingredient symbol={'?'} value={data.result}/>
                </div>
            </div>
        );
    }

    static buildShapelessRecipe(name, data) {
        let cols = data.ingredients.length === 1 ? 1 : data.ingredients.length < 5 ? 2 : 3;
        return (
            <div className="recipe" name={name}>
                <div className={'grid col' + cols}>
                    {data.ingredients.map((e, i) => <Ingredient key={i} symbol={i} value={e}/>)}
                </div>
                <div className="crafting-arrow"/>
                <div className="output">
                    <Ingredient symbol={'?'} value={data.result}/>
                </div>
            </div>
        );
    }
}

class MultiRecipe extends React.Component {
    constructor(props) {
        super(props);
        this.state = {recipeIdx: 0};
    }

    static parseMultiRecipe(branch, array) {
        return Promise.all(array.map(o => Recipe.loadRecipeFromElement(branch, o)).filter(r => r != null))
            .then(recipes => <MultiRecipe recipes={recipes}/>);
    }

    render() {
        return <div className="multi_recipe">
            <button
                className={"recipe_prev" + (this.state.recipeIdx > 0 ? '' : ' off')}
                onClick={() => this.setState({recipeIdx: this.state.recipeIdx - 1})}/>
            {this.props.recipes[this.state.recipeIdx]}
            <button
                className={"recipe_next" + (this.state.recipeIdx < this.props.recipes.length - 1 ? '' : ' off')}
                onClick={() => this.setState({recipeIdx: this.state.recipeIdx + 1})}/>
        </div>;
    }
}

async function imageForItem(item, branch) {
    const basePath = getIconPath(branch);
    const iconPath = basePath + item.domain + '/' + item.name + '.png';
    const response = await fetch(iconPath);
    if (response.ok) {
        const blob = await response.blob();
        return <img className="item" alt={item.domain + ':' + item.name} src={URL.createObjectURL(blob)}/>;
    } else {
        return undefined;
    }
}

function Ingredient(props) {
    let ingredient = props['value'];
    if (!ingredient || !ingredient.rawData)
        return <div className="item empty"/>;
    else {
        return <div className="item" onMouseMove={
            event => {
                let tooltip = event.currentTarget.querySelector('.tooltip');
                if (tooltip) {
                    tooltip.style.position = 'fixed';
                    tooltip.style.top = `calc(${event.clientY}px + 2vmin)`;
                    tooltip.style.left = event.clientX + 'px';
                }
            }
        }>
            {ingredient.itemImage ? ingredient.itemImage : <span className="symbol">{props.symbol}</span>}
            {ingredient.rawData['count'] && <span className="count">{ingredient.rawData['count']}</span>}
            <Tooltip text={ingredient.tooltip}/>
        </div>;
    }
}

class Blueprint extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            recipeIdx: 0
        };
    }

    render() {
        return <div className="blueprint multi_recipe">
            <button
                className={"recipe_prev" + (this.state.recipeIdx > 0 ? '' : ' off')}
                onClick={() => this.setState({recipeIdx: this.state.recipeIdx - 1})}/>
            {this.props.recipes[this.state.recipeIdx]}
            <button
                className={"recipe_next" + (this.state.recipeIdx < this.props.recipes.length - 1 ? '' : ' off')}
                onClick={() => this.setState({recipeIdx: this.state.recipeIdx + 1})}/>
        </div>;
    }

    static loadRecipes(branch, recipes) {
        return Promise.all(recipes.map(
            obj => obj['item'].split(':').pop()
        ).map(
            key => fetch(`${getRecipePath(branch)}blueprint/${key}.json`)
                .then(res => res.json())
                .then(out => Blueprint.buildRecipe(key, out, branch))
        )).then(values => <Blueprint recipes={values}/>);
    }

    static async buildRecipe(name, data, branch) {
        let cols = data.inputs.length === 1 ? 1 : data.inputs.length < 5 ? 2 : 3;
        let ingredients = [];
        for (const e of data.inputs) {
            ingredients.push(await PreparedIngredient.of(e, branch));
        }
        return (
            <div className="recipe" name={name}>
                <div className="blueprint-ingredient">
                    <Ingredient symbol={'B'} value={await PreparedIngredient.of({item: "immersiveengineering:blueprint"}, branch)}/>
                </div>
                <div className={'grid col' + cols}>
                    {ingredients.map((e, i) => <Ingredient key={i} symbol={i} value={e}/>)}
                </div>
                <div className="output">
                    <Ingredient symbol={'?'} value={await PreparedIngredient.of(data.result, branch)}/>
                </div>
            </div>
        );
    }
}
